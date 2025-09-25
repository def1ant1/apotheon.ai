/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import type { KVNamespace } from '@cloudflare/workers-types';
import type { APIRoute } from 'astro';

export const prerender = false;

// Astro's static routing still validates that a `getStaticPaths` export exists
// for any dynamic route even when `prerender` is disabled. We surface the
// canonical preview slug here so local Playwright runs and CI smoke tests can
// fetch `/api/og-test/welcome.png` without tripping the framework guard.
export function getStaticPaths() {
  return [{ params: { slug: 'welcome' } }];
}

interface PreviewRenderEnv {
  OG_IMAGE_CACHE: KVNamespace;
  OG_IMAGE_INTER_FONT_URL?: string;
  OG_IMAGE_FONT_CACHE_TTL_SECONDS?: string;
}

function createPreviewFontCache(): PreviewRenderEnv['OG_IMAGE_CACHE'] {
  const store = new Map<string, ArrayBuffer>();
  return {
    get(key: string, type?: 'arrayBuffer') {
      if (type && type !== 'arrayBuffer') {
        return Promise.resolve(null);
      }
      const value = store.get(key);
      return Promise.resolve(value ? value.slice(0) : null);
    },
    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: { expirationTtl?: number },
    ) {
      // TTL metadata is ignored during preview runs but we acknowledge it to satisfy lint rules.
      const ttlSeconds = options?.expirationTtl;
      void ttlSeconds;
      if (typeof value === 'string') {
        const encoded = new TextEncoder().encode(value);
        store.set(key, encoded.buffer.slice(0));
        return;
      }
      if (value instanceof ArrayBuffer) {
        store.set(key, value.slice(0));
        return;
      }
      if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        store.set(key, view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        return;
      }
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      // eslint-disable-next-line no-constant-condition -- explicit loop termination via break
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        if (!chunk) {
          continue;
        }
        const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        chunks.push(view);
        total += view.byteLength;
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      store.set(key, merged.buffer);
    },
  } as PreviewRenderEnv['OG_IMAGE_CACHE'];
}

const previewEnv: PreviewRenderEnv = {
  OG_IMAGE_CACHE: createPreviewFontCache(),
  OG_IMAGE_INTER_FONT_URL: process.env.OG_IMAGE_INTER_FONT_URL,
  OG_IMAGE_FONT_CACHE_TTL_SECONDS: process.env.OG_IMAGE_FONT_CACHE_TTL_SECONDS,
};

export const GET: APIRoute = async ({ params, request }) => {
  if (import.meta.env.PROD) {
    return new Response('OG preview disabled in static builds.', { status: 503 });
  }

  let testingExports: typeof import('../../../../workers/og-images').__TESTING__ | undefined;
  try {
    ({ __TESTING__: testingExports } = await import('../../../../workers/og-images'));
  } catch (error) {
    console.error('[og-preview] Failed to load worker renderer:', error);
    return new Response('OG preview unavailable. Please run npm run dev via Wrangler.', {
      status: 503,
    });
  }

  const slug = params.slug ?? 'preview';
  const url = new URL(request.url);
  const title = url.searchParams.get('title') ?? 'Preview';
  const subtitle = url.searchParams.get('subtitle') ?? 'Generated during visual regression';
  const themeParam = url.searchParams.get('theme');
  const theme: 'light' | 'dark' = themeParam === 'light' ? 'light' : 'dark';

  const png = await testingExports.renderOgImage(previewEnv, {
    scope: 'blog',
    slug,
    variant: 'default',
    title,
    subtitle,
    eyebrow: url.searchParams.get('eyebrow') ?? 'Apotheon.ai Insights',
    accent: url.searchParams.get('accent') ?? '#38bdf8',
    theme,
    source: undefined,
  });

  const arrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);

  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
};
