import { webcrypto } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OgImageEnv } from '../../workers/og-images';
import type {
  ExecutionContext,
  ExportedHandler,
  IncomingRequestCfProperties,
  Request as WorkerRequest,
} from '@cloudflare/workers-types';

vi.mock('@resvg/resvg-js', () => ({
  __esModule: true,
  Resvg: class {
    render() {
      return {
        asPng() {
          return new Uint8Array(0);
        },
      };
    }
  },
}));

vi.mock('satori', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue('<svg></svg>'),
}));

vi.mock('../../workers/shared/fonts/inter', () => ({
  getInterFontData: vi.fn().mockResolvedValue(new Uint8Array(0)),
}));

describe('OG worker cache hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (globalThis as any).caches;
  });

  it('rejects expired signatures before consulting the HTTP cache', async () => {
    // Simulate a warmed HTTP cache entry so the worker would have returned it
    // immediately prior to this regression fix. We expect the validation layer
    // to intercept the request before these spies observe any traffic.
    const matchSpy = vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200 }));
    const putSpy = vi.fn();
    (globalThis as any).caches = {
      default: {
        match: matchSpy,
        put: putSpy,
      },
    };

    const waitUntil = vi.fn();
    const ctx = {
      waitUntil,
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    const env = {
      OG_IMAGE_SIGNING_SECRET: 'secret',
      OG_IMAGE_CACHE: {
        getWithMetadata: vi.fn(),
        put: vi.fn(),
      },
      OG_IMAGE_ASSET_DB: {
        prepare: vi.fn(() => ({
          bind: () => ({
            run: vi.fn(),
            all: vi.fn(),
            raw: vi.fn(),
            first: vi.fn(),
          }),
        })),
      },
    } as unknown as OgImageEnv;

    const request = new Request(
      'https://worker.example.com/og/blog/demo?title=Demo&expires=1&signature=deadbeef',
    );

    const { default: worker } = (await import('../../workers/og-images')) as {
      default: ExportedHandler<OgImageEnv>;
    };

    expect(worker.fetch).toBeDefined();

    const workerRequest = request as unknown as WorkerRequest<
      unknown,
      IncomingRequestCfProperties<unknown>
    >;

    const response = await worker.fetch!(workerRequest, env, ctx);

    expect(response.status).toBe(410);
    expect(matchSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
  });
});
