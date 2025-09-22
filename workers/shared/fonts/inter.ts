/**
 * Inter font bootstrapper
 * ------------------------
 *
 * The OG worker relies on Inter to match the marketing site typography. Instead
 * of bundling binary font payloads in the repository, we download the font from
 * a configurable origin, persist it to KV for cross-isolate reuse, and memoise
 * it in-memory to avoid repeated array allocations. This keeps the repository
 * text-only while still guaranteeing consistent renders.
 */
import type { KVNamespace } from '@cloudflare/workers-types';

const DEFAULT_FONT_URL = 'https://rsms.me/inter/font-files/Inter-roman.var.woff2';
const CACHE_KEY_PREFIX = 'fonts::inter::';
const KV_FALLBACK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const inMemoryFonts = new Map<string, Promise<Uint8Array>>();

interface FontCacheOptions {
  fontUrl?: string | null | undefined;
  ttlSeconds?: string | number | null | undefined;
}

function buildCacheKey(url: string): string {
  return `${CACHE_KEY_PREFIX}${encodeURIComponent(url)}`;
}

function parseTtl(candidate: string | number | null | undefined): number {
  if (candidate == null || candidate === '') {
    return KV_FALLBACK_TTL_SECONDS;
  }
  const parsed = Number(candidate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : KV_FALLBACK_TTL_SECONDS;
}

async function downloadFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    cf: {
      cacheTtl: 60 * 60 * 24, // 24 hours at the edge so isolates share warmed assets
      cacheEverything: true,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Inter font (status ${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Empty Inter font payload received.');
  }

  return new Uint8Array(buffer);
}

export async function getInterFontData(
  cache: KVNamespace,
  options: FontCacheOptions = {},
): Promise<Uint8Array> {
  const sourceUrl = options.fontUrl?.toString().trim() || DEFAULT_FONT_URL;
  const memoised = inMemoryFonts.get(sourceUrl);
  if (memoised) {
    return memoised;
  }

  const fontPromise = (async () => {
    const cacheKey = buildCacheKey(sourceUrl);
    const cached = await cache.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Uint8Array(cached);
    }

    const downloaded = await downloadFont(sourceUrl);
    const ttlSeconds = parseTtl(options.ttlSeconds);
    const persisted = downloaded.slice();
    await cache.put(cacheKey, persisted.buffer, { expirationTtl: ttlSeconds });
    return downloaded;
  })().catch((error) => {
    inMemoryFonts.delete(sourceUrl);
    throw error;
  });

  inMemoryFonts.set(sourceUrl, fontPromise);
  return fontPromise;
}
