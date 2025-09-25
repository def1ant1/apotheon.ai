import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KVNamespace } from '@cloudflare/workers-types';

function createKvStub(): KVNamespace {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    getWithMetadata: vi.fn().mockResolvedValue(null),
  } as unknown as KVNamespace;
}

describe('Inter font loader fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the embedded subset when fetch fails', async () => {
    const kv = createKvStub();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { getInterFontData } = await import('../../workers/shared/fonts/inter');

    const fontBytes = await getInterFontData(kv);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Falling back to embedded Inter subset');
    expect(fontBytes.regular).toBeInstanceOf(Uint8Array);
    expect(fontBytes.bold).toBeInstanceOf(Uint8Array);
    expect(fontBytes.regular.byteLength).toBeGreaterThan(0);
    expect(fontBytes.bold.byteLength).toBeGreaterThan(0);
    expect(Array.from(fontBytes.regular.slice(0, 4))).toEqual([119, 79, 70, 70]);
    expect(Array.from(fontBytes.bold.slice(0, 4))).toEqual([119, 79, 70, 70]);
  });

  it('memoises fallback bytes across invocations', async () => {
    const kv = createKvStub();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const { getInterFontData } = await import('../../workers/shared/fonts/inter');

    const first = await getInterFontData(kv);
    const second = await getInterFontData(kv);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
    expect(second.regular).toBe(first.regular);
    expect(second.bold).toBe(first.bold);
  });
});
