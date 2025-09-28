import { beforeEach, describe, expect, it, vi } from 'vitest';

const detectLocaleFromPathMock = vi.fn();
const resolveTranslatorMock = vi.fn();
const getDefaultLocaleMock = vi.fn(() => 'en');

vi.mock('../../../src/i18n/index', () => ({
  /**
   * We surface a predictable locale catalogue so the assertions stay deterministic even if the
   * real integration adds or removes languages down the road.
   */
  SUPPORTED_LOCALES: ['en', 'es', 'fr'] as const,
  detectLocaleFromPath: detectLocaleFromPathMock,
  localizePath: vi.fn(),
  localizeUrl: vi.fn(),
  getDefaultLocale: getDefaultLocaleMock,
  useTranslations: resolveTranslatorMock,
}));

describe('runtime i18n bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    detectLocaleFromPathMock.mockReset();
    resolveTranslatorMock.mockReset();
    getDefaultLocaleMock.mockReset();
    getDefaultLocaleMock.mockReturnValue('en');
  });

  it('hydrates translators bound to the locale detected from the Astro URL', async () => {
    detectLocaleFromPathMock.mockReturnValue('es');

    const translatorSpy = vi.fn((key: string) => `es::${key}`);
    resolveTranslatorMock.mockReturnValue(translatorSpy);

    const { useTranslations } = await import('../../../src/i18n/runtime');

    const astro = {
      url: new URL('https://example.com/es/scope'),
    } as unknown as import('astro').AstroGlobal;

    const { t } = await useTranslations(astro);

    expect(resolveTranslatorMock).toHaveBeenCalledWith(undefined, 'es');
    expect(t('navigation.primary.home', { defaultValue: 'Home' })).toBe(
      'es::navigation.primary.home',
    );
    expect(translatorSpy).toHaveBeenCalledWith('navigation.primary.home', { defaultValue: 'Home' });
  });

  it('falls back to the i18next language stored on Astro.locals when path detection fails', async () => {
    detectLocaleFromPathMock.mockReturnValue(undefined);

    const translatorSpy = vi.fn((key: string) => `fr::${key}`);
    resolveTranslatorMock.mockReturnValue(translatorSpy);

    const { useTranslations } = await import('../../../src/i18n/runtime');

    const astro = {
      url: new URL('https://example.com/enterprise'),
      locals: { i18next: { language: 'fr' } },
    } as unknown as import('astro').AstroGlobal;

    const { t } = await useTranslations(astro);

    expect(resolveTranslatorMock).toHaveBeenCalledWith(undefined, 'fr');
    expect(t('navigation.primary.contact', { defaultValue: 'Contact' })).toBe(
      'fr::navigation.primary.contact',
    );
    expect(translatorSpy).toHaveBeenCalledWith('navigation.primary.contact', {
      defaultValue: 'Contact',
    });
  });

  it('defaults to the canonical locale when no runtime hints are present', async () => {
    detectLocaleFromPathMock.mockReturnValue(undefined);

    const translatorSpy = vi.fn((key: string) => `en::${key}`);
    resolveTranslatorMock.mockReturnValue(translatorSpy);
    getDefaultLocaleMock.mockReturnValue('en');

    const { useTranslations } = await import('../../../src/i18n/runtime');

    const astro = {
      url: new URL('https://example.com'),
    } as unknown as import('astro').AstroGlobal;

    await useTranslations(astro);

    expect(resolveTranslatorMock).toHaveBeenCalledWith(undefined, 'en');
    expect(getDefaultLocaleMock).toHaveBeenCalledTimes(1);
  });
});
