import { beforeEach, describe, expect, it, vi } from 'vitest';

const fontBytes = new Uint8Array([1, 2, 3]);
const asPngMock = vi.fn(() => new Uint8Array([9, 9, 9]));
const renderMock = vi.fn(() => ({ asPng: asPngMock }));
const resvgInstances = [];

const satoriMock = vi.fn().mockResolvedValue('<svg>mock</svg>');
const getInterFontDataMock = vi.fn().mockResolvedValue(fontBytes);

vi.mock('satori', () => ({
  __esModule: true,
  default: (...args) => satoriMock(...args),
}));

vi.mock('@resvg/resvg-js', () => ({
  __esModule: true,
  Resvg: vi.fn().mockImplementation((svg, options) => {
    resvgInstances.push({ svg, options });
    return { render: renderMock };
  }),
}));

vi.mock('../../workers/shared/fonts/inter', () => ({
  getInterFontData: (...args) => getInterFontDataMock(...args),
}));

describe('OG worker rendering integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resvgInstances.length = 0;
    satoriMock.mockResolvedValue('<svg>mock</svg>');
    getInterFontDataMock.mockResolvedValue(fontBytes);
    asPngMock.mockReturnValue(new Uint8Array([9, 9, 9]));
    renderMock.mockImplementation(() => ({ asPng: asPngMock }));
  });

  it('invokes Satori + ResVG to produce PNG bytes with expected styling', async () => {
    const { __TESTING__ } = await import('../../workers/og-images');
    const payload = {
      scope: 'blog',
      slug: 'enterprise-ai',
      variant: 'default',
      title: 'Enterprise AI Controls',
      subtitle: 'Operational guardrails for Fortune 100 platforms',
      eyebrow: 'Insights',
      accent: '#00aaff',
      theme: 'dark',
      source: 'https://apotheon.ai/blog/enterprise-ai/',
    } as const;

    const env = {
      OG_IMAGE_CACHE: { get: vi.fn(), put: vi.fn() },
      OG_IMAGE_INTER_FONT_URL: undefined,
      OG_IMAGE_FONT_CACHE_TTL_SECONDS: undefined,
    } as const;

    const result = await __TESTING__.renderOgImage(env, payload);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([9, 9, 9]);

    expect(getInterFontDataMock).toHaveBeenCalledWith(env.OG_IMAGE_CACHE, {
      fontUrl: env.OG_IMAGE_INTER_FONT_URL,
      ttlSeconds: env.OG_IMAGE_FONT_CACHE_TTL_SECONDS,
    });

    expect(satoriMock).toHaveBeenCalledTimes(1);
    const [tree, options] = satoriMock.mock.calls[0]!;
    expect(options).toMatchObject({ width: 1200, height: 630 });
    expect(Array.isArray(options.fonts)).toBe(true);
    expect(options.fonts?.[0]?.data).toBe(fontBytes);

    const serialisedTree = JSON.stringify(tree);
    expect(serialisedTree).toContain(payload.title);
    expect(serialisedTree).toContain(payload.subtitle!);
    expect(serialisedTree).toContain(payload.eyebrow!);

    expect(resvgInstances).toHaveLength(1);
    expect(resvgInstances[0]).toMatchObject({
      svg: '<svg>mock</svg>',
      options: expect.objectContaining({
        fitTo: { mode: 'width', value: 1200 },
        background: 'transparent',
      }),
    });

    expect(renderMock).toHaveBeenCalled();
    expect(asPngMock).toHaveBeenCalled();
  });
});
