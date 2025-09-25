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
import {
  INTER_LATIN_FALLBACK_BOLD_BASE64,
  INTER_LATIN_FALLBACK_REGULAR_BASE64,
} from './inter.preview-fallback';

import type { KVNamespace } from '@cloudflare/workers-types';

const DEFAULT_FONT_URL = 'https://rsms.me/inter/font-files/Inter-roman.var.woff2';
const CACHE_KEY_PREFIX = 'fonts::inter::';
const KV_FALLBACK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface InterFontSet {
  regular: Uint8Array;
  bold: Uint8Array;
}

const inMemoryFonts = new Map<string, Promise<InterFontSet>>();
let fallbackFonts: InterFontSet | null = null;

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

function decodeBase64ToUint8Array(encoded: string): Uint8Array {
  const normalised = encoded.replace(/\s+/g, '');

  if (typeof Buffer !== 'undefined') {
    const decoded = Buffer.from(normalised, 'base64');
    return new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  }

  const binary = globalThis.atob(normalised);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getFallbackFontData(): InterFontSet {
  if (!fallbackFonts) {
    fallbackFonts = {
      regular: decodeBase64ToUint8Array(INTER_LATIN_FALLBACK_REGULAR_BASE64),
      bold: decodeBase64ToUint8Array(INTER_LATIN_FALLBACK_BOLD_BASE64),
    };
  }
  return fallbackFonts;
}

export async function getInterFontData(
  cache: KVNamespace,
  options: FontCacheOptions = {},
): Promise<InterFontSet> {
  const sourceUrl = options.fontUrl?.toString().trim() || DEFAULT_FONT_URL;
  const memoised = inMemoryFonts.get(sourceUrl);
  if (memoised) {
    return memoised;
  }

  const fontPromise = (async () => {
    const cacheKey = buildCacheKey(sourceUrl);
    const cached = await cache.get(cacheKey, 'arrayBuffer');
    if (cached) {
      const bytes = new Uint8Array(cached);
      return { regular: bytes, bold: bytes };
    }

    const downloaded = await downloadFont(sourceUrl);
    const ttlSeconds = parseTtl(options.ttlSeconds);
    const persisted = downloaded.slice();
    await cache.put(cacheKey, persisted.buffer, { expirationTtl: ttlSeconds });
    return { regular: downloaded, bold: downloaded };
  })().catch((error) => {
    inMemoryFonts.delete(sourceUrl);
    console.warn('[og-images] Falling back to embedded Inter subset for preview render.', error);
    return Promise.resolve(getFallbackFontData());
  });

  inMemoryFonts.set(sourceUrl, fontPromise);
  return fontPromise;
}
