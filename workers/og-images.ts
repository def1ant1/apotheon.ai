/// <reference types="@cloudflare/workers-types" />
/// <reference path="../src/types/og-worker.d.ts" />

/**
 * OpenGraph Image Worker
 * ----------------------
 *
 * The Worker renders branded OpenGraph cards on-demand using Satori to build
 * vector markup and ResVG to rasterize the final PNG. We lean on KV + the edge
 * cache so social scrapers hit fully warmed assets while the D1 table keeps a
 * durable audit trail for compliance and analytics pipelines.
 */
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

import { toBase64Url } from './shared/base64';
import { getInterFontData } from './shared/fonts/inter';

import type { KVNamespace } from '@cloudflare/workers-types';
import type { ReactElement } from 'react';

type FontDefinition = {
  name: string;
  data: Uint8Array;
  style?: string;
  weight?: number | string;
};

type SatoriOptions = {
  width: number;
  height: number;
  fonts: FontDefinition[];
  embedFont?: boolean;
};

type SatoriRenderer = (element: ReactElement, options: SatoriOptions) => Promise<string>;

type ResvgConstructor = new (
  svg: string,
  options: {
    fitTo?: {
      mode: 'width';
      value: number;
    };
    background?: string;
  },
) => {
  render(): {
    asPng(): Uint8Array;
  };
};

const renderWithSatori = satori as unknown as SatoriRenderer;
const ResvgRenderer = Resvg as unknown as ResvgConstructor;

export interface OgImageEnv {
  OG_IMAGE_SIGNING_SECRET: string;
  OG_IMAGE_CACHE: KVNamespace;
  OG_IMAGE_ASSET_DB: D1Database;
  OG_IMAGE_CACHE_TTL_SECONDS?: string;
  OG_IMAGE_ALLOWED_SCOPES?: string;
  OG_IMAGE_ALLOWED_THEMES?: string;
  OG_IMAGE_INTER_FONT_URL?: string;
  OG_IMAGE_FONT_CACHE_TTL_SECONDS?: string;
}

type FontRuntimeEnv = Pick<
  OgImageEnv,
  'OG_IMAGE_CACHE' | 'OG_IMAGE_INTER_FONT_URL' | 'OG_IMAGE_FONT_CACHE_TTL_SECONDS'
>;

type OgScope = 'blog' | 'marketing';

type OgTheme = 'dark' | 'light';

type RenderVariant = 'default';

type OgCacheMetadata = {
  scope: OgScope;
  slug: string;
  variant: RenderVariant;
  theme: OgTheme;
  accent?: string | null;
  width: number;
  height: number;
  renderedAt: string;
  expiresAt: string;
  checksum: string;
};

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const CACHE_TTL_DEFAULT_SECONDS = 60 * 60 * 24 * 7; // 7 days
const HTTP_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days for social bots

const SUPPORTED_SCOPES: ReadonlySet<OgScope> = new Set(['blog', 'marketing']);
const SUPPORTED_THEMES: ReadonlySet<OgTheme> = new Set(['dark', 'light']);

/** Guardrail used by tests + runtime so we avoid leaking details in responses. */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface RenderPayload {
  scope: OgScope;
  slug: string;
  variant: RenderVariant;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: string;
  theme: OgTheme;
  source?: string;
}

function parseScope(
  candidate: string | null | undefined,
  allowedScopes: ReadonlySet<string>,
): OgScope {
  if (!candidate) {
    throw new HttpError(400, 'Missing OpenGraph scope.');
  }
  if (!allowedScopes.has(candidate)) {
    throw new HttpError(400, 'Unsupported OpenGraph scope.');
  }
  return candidate as OgScope;
}

function parseTheme(
  candidate: string | null | undefined,
  allowedThemes: ReadonlySet<string>,
): OgTheme {
  if (!candidate) {
    return 'dark';
  }
  if (!allowedThemes.has(candidate)) {
    throw new HttpError(400, 'Unsupported theme.');
  }
  return candidate as OgTheme;
}

function parseExpires(raw: string | null): number {
  if (!raw) {
    throw new HttpError(400, 'Missing signature expiry.');
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, 'Invalid signature expiry.');
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (parsed < nowSeconds) {
    throw new HttpError(410, 'Signed URL expired.');
  }
  return parsed;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function buildCanonicalPayload(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.delete('signature');
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonical = new URLSearchParams(entries);
  return `${url.pathname}?${canonical.toString()}`;
}

async function calculateSignature(secret: string, canonical: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return toBase64Url(signatureBytes);
}

async function assertValidSignature(secret: string, url: URL): Promise<void> {
  const provided = url.searchParams.get('signature');
  if (!provided) {
    throw new HttpError(400, 'Missing signature.');
  }
  const canonical = buildCanonicalPayload(url);
  const expected = await calculateSignature(secret, canonical);
  if (!timingSafeEqual(provided, expected)) {
    throw new HttpError(403, 'Signature verification failed.');
  }
}

function buildCacheKey(payload: RenderPayload, signature: string): string {
  return `og:${payload.scope}:${payload.slug}:${payload.variant}:${signature}`;
}

function parseRequest(
  url: URL,
  allowedScopes: ReadonlySet<string>,
  allowedThemes: ReadonlySet<string>,
): RenderPayload {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'og') {
    throw new HttpError(404, 'Unsupported route.');
  }
  const scope = parseScope(segments[1], allowedScopes);
  const slug = decodeURIComponent(segments.slice(2).join('/'));
  const variant = (url.searchParams.get('variant') ?? 'default') as RenderVariant;
  const title = url.searchParams.get('title');
  if (!title) {
    throw new HttpError(400, 'Missing OpenGraph title.');
  }
  const subtitle = url.searchParams.get('subtitle') ?? undefined;
  const eyebrow = url.searchParams.get('eyebrow') ?? undefined;
  const accent = url.searchParams.get('accent') ?? undefined;
  const theme = parseTheme(url.searchParams.get('theme'), allowedThemes);
  const source = url.searchParams.get('source') ?? undefined;

  return { scope, slug, variant, title, subtitle, eyebrow, accent, theme, source };
}

type OgJsxNode = ReactElement;

type OgElementChild = OgJsxNode | string | number | null;

type OgElementProps = {
  style?: Record<string, unknown>;
  children?: OgElementChild | OgElementChild[];
} & Record<string, unknown>;

function h(type: string, props: OgElementProps = {}, key: string | null = null): OgJsxNode {
  return { type, key, props } as unknown as ReactElement;
}

function renderBackground(payload: RenderPayload): OgJsxNode {
  const gradientStops =
    payload.theme === 'dark'
      ? ['#020817', payload.accent ?? '#0f172a']
      : ['#f8fafc', payload.accent ?? '#38bdf8'];
  return h('div', {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: `linear-gradient(135deg, ${gradientStops[0]}, ${gradientStops[1]})`,
    },
    children: [
      h('div', {
        style: {
          flex: 1,
          opacity: payload.theme === 'dark' ? 0.9 : 0.85,
          background: payload.theme === 'dark' ? '#020617aa' : '#ffffffbb',
          backdropFilter: 'blur(60px)',
        },
      }),
    ],
  });
}

function renderContent(payload: RenderPayload): OgJsxNode {
  const textColor = payload.theme === 'dark' ? '#f8fafc' : '#0f172a';
  const secondaryColor = payload.theme === 'dark' ? '#cbd5f5' : '#1e293b';
  const headerBlocks: OgJsxNode[] = [];
  if (payload.eyebrow) {
    headerBlocks.push(
      h('div', {
        style: {
          fontSize: 24,
          letterSpacing: 6,
          textTransform: 'uppercase',
          fontWeight: 600,
          color: secondaryColor,
        },
        children: payload.eyebrow,
      }),
    );
  }

  headerBlocks.push(
    h('div', {
      style: {
        fontSize: 72,
        lineHeight: 1.05,
        fontWeight: 700,
        color: textColor,
        maxWidth: 840,
      },
      children: payload.title,
    }),
  );

  if (payload.subtitle) {
    headerBlocks.push(
      h('div', {
        style: {
          fontSize: 34,
          lineHeight: 1.4,
          color: secondaryColor,
          maxWidth: 780,
        },
        children: payload.subtitle,
      }),
    );
  }

  return h('div', {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 80,
      width: '100%',
      height: '100%',
      fontFamily: 'Inter',
    },
    children: [
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        },
        children: headerBlocks,
      }),
      h('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 28,
          color: secondaryColor,
        },
        children: [
          h('div', {
            style: {
              fontWeight: 600,
              color: textColor,
            },
            children: payload.scope === 'blog' ? 'Apotheon.ai Insights' : 'Apotheon.ai Platform',
          }),
          h('div', {
            style: {
              display: 'flex',
              gap: 16,
            },
            children: [
              h('div', {
                style: {
                  width: 18,
                  height: 18,
                  borderRadius: '9999px',
                  background: payload.accent ?? (payload.theme === 'dark' ? '#38bdf8' : '#0284c7'),
                },
              }),
              h('div', {
                style: {
                  fontWeight: 500,
                  color: textColor,
                },
                children: payload.slug,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function renderOgImage(env: FontRuntimeEnv, payload: RenderPayload): Promise<Uint8Array> {
  const interFont = await getInterFontData(env.OG_IMAGE_CACHE, {
    fontUrl: env.OG_IMAGE_INTER_FONT_URL,
    ttlSeconds: env.OG_IMAGE_FONT_CACHE_TTL_SECONDS,
  });
  const svg = await renderWithSatori(
    h('div', {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      children: [renderBackground(payload), renderContent(payload)],
    }),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      fonts: [
        { name: 'Inter', data: interFont, style: 'normal', weight: 500 },
        { name: 'Inter', data: interFont, style: 'normal', weight: 700 },
      ],
      embedFont: true,
    },
  );

  const renderer = new ResvgRenderer(svg, {
    fitTo: {
      mode: 'width',
      value: IMAGE_WIDTH,
    },
    background: 'transparent',
  });

  const image = renderer.render().asPng();
  if (!(image instanceof Uint8Array)) {
    throw new TypeError('Resvg.asPng() did not return a Uint8Array.');
  }
  return image;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function persistMetadata(
  env: OgImageEnv,
  payload: RenderPayload,
  kvKey: string,
  signature: string,
  checksum: string,
  expires: number,
): Promise<void> {
  const statement = env.OG_IMAGE_ASSET_DB.prepare(`
    INSERT INTO og_assets
      (scope, slug, variant, format, cache_key, signature, source_url, title, subtitle, theme, accent, width, height, checksum, rendered_at, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'), datetime(?15))
    ON CONFLICT(scope, slug, variant, format) DO UPDATE SET
      cache_key = excluded.cache_key,
      signature = excluded.signature,
      source_url = excluded.source_url,
      title = excluded.title,
      subtitle = excluded.subtitle,
      theme = excluded.theme,
      accent = excluded.accent,
      width = excluded.width,
      height = excluded.height,
      checksum = excluded.checksum,
      rendered_at = datetime('now'),
      expires_at = excluded.expires_at;
  `);

  await statement
    .bind(
      payload.scope,
      payload.slug,
      payload.variant,
      'image/png',
      kvKey,
      signature,
      payload.source ?? null,
      payload.title,
      payload.subtitle ?? null,
      payload.theme,
      payload.accent ?? null,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
      checksum,
      new Date(expires * 1000).toISOString(),
    )
    .run();
}

function buildResponseHeaders(metadata: OgCacheMetadata, length: number): Headers {
  return new Headers({
    'Content-Type': 'image/png',
    'Cache-Control': `public, max-age=${HTTP_CACHE_TTL_SECONDS}, immutable`,
    'Content-Length': String(length),
    ETag: metadata.checksum,
    'X-OG-Scope': metadata.scope,
    'X-OG-Slug': metadata.slug,
    'X-OG-Variant': metadata.variant,
    'X-OG-Theme': metadata.theme,
    'X-OG-Expires-At': metadata.expiresAt,
  });
}

async function respondWithCachedAsset(
  request: Request,
  cache: Cache,
  cacheLookupRequest: Request,
  kvValue: ArrayBuffer,
  metadata: OgCacheMetadata,
): Promise<Response> {
  const headers = buildResponseHeaders(metadata, kvValue.byteLength);
  const body = request.method === 'HEAD' ? null : kvValue.slice(0);
  const response = new Response(body, { status: 200, headers });
  const cacheResponse = new Response(kvValue.slice(0), { status: 200, headers });
  await cache.put(cacheLookupRequest, cacheResponse);
  return response;
}

async function handleRequest(
  request: Request,
  env: OgImageEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const allowedScopes = env.OG_IMAGE_ALLOWED_SCOPES
    ? new Set(
        env.OG_IMAGE_ALLOWED_SCOPES.split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      )
    : SUPPORTED_SCOPES;
  const allowedThemes = env.OG_IMAGE_ALLOWED_THEMES
    ? new Set(
        env.OG_IMAGE_ALLOWED_THEMES.split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      )
    : SUPPORTED_THEMES;

  const expires = parseExpires(url.searchParams.get('expires'));
  await assertValidSignature(env.OG_IMAGE_SIGNING_SECRET, url);
  const payload = parseRequest(url, allowedScopes, allowedThemes);

  // We only consult the edge cache after verifying the signed URL inputs so a
  // stale request cannot bypass scope/theme/expiry checks by reusing a cached
  // payload that was rendered while the signature was still valid.
  const cacheStorage = caches as unknown as CacheStorage & { default: Cache };
  const cache = cacheStorage.default;
  const cacheLookupRequest = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheLookupRequest);
  if (cached) {
    if (request.method === 'HEAD') {
      return new Response(null, { headers: cached.headers, status: cached.status });
    }
    return cached;
  }

  const signature = url.searchParams.get('signature') ?? '';
  const cacheKey = buildCacheKey(payload, signature);

  const kv = await env.OG_IMAGE_CACHE.getWithMetadata<OgCacheMetadata>(cacheKey, 'arrayBuffer');
  if (kv && kv.value && kv.metadata) {
    return respondWithCachedAsset(request, cache, cacheLookupRequest, kv.value, kv.metadata);
  }

  const image = await renderOgImage(env, payload);
  const arrayBuffer = toArrayBuffer(image);
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const checksum = `"${toBase64Url(digest)}"`;
  const metadata: OgCacheMetadata = {
    scope: payload.scope,
    slug: payload.slug,
    variant: payload.variant,
    theme: payload.theme,
    accent: payload.accent,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    renderedAt: new Date().toISOString(),
    expiresAt: new Date(expires * 1000).toISOString(),
    checksum,
  };

  const ttlSeconds = Number(env.OG_IMAGE_CACHE_TTL_SECONDS ?? CACHE_TTL_DEFAULT_SECONDS);
  await env.OG_IMAGE_CACHE.put(cacheKey, arrayBuffer, {
    expirationTtl: ttlSeconds,
    metadata,
  });

  ctx.waitUntil(persistMetadata(env, payload, cacheKey, signature, checksum, expires));

  const headers = buildResponseHeaders(metadata, arrayBuffer.byteLength);
  const responseBody = request.method === 'HEAD' ? null : arrayBuffer.slice(0);
  const response = new Response(responseBody, { status: 200, headers });
  ctx.waitUntil(
    cache.put(cacheLookupRequest, new Response(arrayBuffer.slice(0), { status: 200, headers })),
  );
  return response;
}

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}

function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return new Response(error.message, {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const serialised =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error('[og-images] Unhandled exception:', serialised);
  return new Response('Internal Server Error', {
    status: 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const __TESTING__ = {
  buildCanonicalPayload,
  calculateSignature,
  timingSafeEqual,
  parseRequest,
  renderOgImage,
  buildCacheKey,
};

const worker: ExportedHandler<OgImageEnv> = {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return methodNotAllowed();
    }
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      return handleError(error);
    }
  },
};

export default worker;
