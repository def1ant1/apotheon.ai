import { createHmac } from 'node:crypto';

import {
  buildManifestKey,
  getManifestEntry,
  upsertManifestEntry,
  type OgManifestEntry,
  type OgScope,
} from './og-manifest';

export interface EnsureOgAssetOptions {
  workerEndpoint: string;
  signingKey: string;
  scope: OgScope;
  slug: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: string;
  variant?: string;
  theme?: 'dark' | 'light';
  source?: string;
  lcpCandidate?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
  ttlSeconds?: number;
}

export interface EnsureOgAssetResult extends OgManifestEntry {}

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 45; // 45 days so signatures outlive social caching.

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function canonicaliseSearchParams(params: URLSearchParams): URLSearchParams {
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonical = new URLSearchParams();
  for (const [key, value] of entries) {
    if (key === 'signature') continue;
    canonical.append(key, value);
  }
  return canonical;
}

function buildSignedUrl(options: EnsureOgAssetOptions, expires: number): URL {
  const variant = options.variant ?? 'default';
  const slugSegments = options.slug.split('/').map((segment) => encodeURIComponent(segment));
  const url = new URL(`/og/${options.scope}/${slugSegments.join('/')}`, options.workerEndpoint);
  const params = url.searchParams;
  params.set('title', options.title);
  if (options.subtitle) params.set('subtitle', options.subtitle);
  if (options.eyebrow) params.set('eyebrow', options.eyebrow);
  if (options.accent) params.set('accent', options.accent);
  if (options.theme) params.set('theme', options.theme);
  if (options.source) params.set('source', options.source);
  params.set('variant', variant);
  params.set('expires', String(expires));

  const canonical = canonicaliseSearchParams(params);
  const canonicalPayload = `${url.pathname}?${canonical.toString()}`;
  const signature = toBase64Url(
    createHmac('sha256', options.signingKey).update(canonicalPayload).digest(),
  );
  params.set('signature', signature);
  return url;
}

export function isManifestEntryFresh(
  entry: OgManifestEntry,
  workerEndpoint: string,
  now = Date.now(),
): boolean {
  if (entry.workerEndpoint !== workerEndpoint) return false;
  const expiresAt = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now + 60_000; // keep a one-minute buffer.
}

export async function ensureOgAsset(options: EnsureOgAssetOptions): Promise<EnsureOgAssetResult> {
  const variant = options.variant ?? 'default';
  const key = buildManifestKey(options.scope, options.slug, variant);
  const now = options.now ? options.now() : Date.now();
  const existing = await getManifestEntry(options.scope, options.slug, variant);
  if (existing && isManifestEntryFresh(existing, options.workerEndpoint, now)) {
    return existing;
  }

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const expires = Math.floor(now / 1000) + ttlSeconds;
  const signedUrl = buildSignedUrl(options, expires);
  const fetcher = options.fetchImpl ?? fetch;

  const response = await fetcher(signedUrl.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'Apotheon-OG-Automation/1.0 (+https://apotheon.ai/docs)',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OG Worker returned ${response.status} ${response.statusText} for ${signedUrl.pathname}: ${body.slice(0, 200)}`,
    );
  }

  // Read the body once to warm KV + caches. We intentionally discard the bytes afterwards because downstream
  // rendering only needs the canonical URL in the manifest.
  await response.arrayBuffer();

  const signature = signedUrl.searchParams.get('signature') ?? '';
  const result: OgManifestEntry = {
    key,
    scope: options.scope,
    slug: options.slug,
    variant,
    url: signedUrl.toString(),
    workerEndpoint: options.workerEndpoint,
    signature,
    expiresAt: new Date(expires * 1000).toISOString(),
    generatedAt: new Date(now).toISOString(),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    format: response.headers.get('content-type') ?? 'image/png',
    source: options.source,
    lcpCandidate: options.lcpCandidate,
  };

  await upsertManifestEntry(result);
  return result;
}
