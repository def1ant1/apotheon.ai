import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFixedTMock = vi.fn();
const i18nextState = { isInitialized: true } as { isInitialized: boolean };

vi.mock('i18next', () => ({
  default: i18nextState,
  getFixedT: getFixedTMock,
}));

const CONFIG_MODULE = '../../../src/i18n/i18next.server.mjs';

/**
 * Resetting module state between assertions keeps the memoisation surface honest and prevents
 * inter-test pollution when we override the runtime config.
 */
const resetRuntimeModules = async () => {
  vi.resetModules();
  vi.doUnmock(CONFIG_MODULE);
};

describe('i18n runtime helpers', () => {
  beforeEach(async () => {
    getFixedTMock.mockReset();
    i18nextState.isInitialized = true;
    await resetRuntimeModules();
  });

  it('falls back to canonical copy when translators fail or are unavailable', async () => {
    const { translateWithFallback } = await import('../../../src/i18n/translator');

    const fallback = 'Enterprise baseline copy';

    expect(translateWithFallback(undefined, 'navigation.primary.home', fallback)).toBe(fallback);

    const throwingTranslator = vi.fn(() => {
      throw new Error('boom');
    });

    expect(translateWithFallback(throwingTranslator, 'navigation.primary.home', fallback)).toBe(
      fallback,
    );
    expect(throwingTranslator).toHaveBeenCalledWith('navigation.primary.home', {
      defaultValue: fallback,
    });
  });

  it('uses default locale + namespace constants when the runtime config omits overrides', async () => {
    vi.doMock(CONFIG_MODULE, () => ({
      DEFAULT_LOCALE: 'en',
      SUPPORTED_LOCALES: ['en', 'es'],
      DEFAULT_NAMESPACE: 'common',
      NAMESPACES: ['common'],
      default: {
        locales: ['en', 'es'],
        namespaces: ['common'],
        load: ['server'],
      },
    }));

    const { getDefaultLocale, getDefaultNamespace, getNamespaces } = await import(
      '../../../src/i18n/index'
    );

    expect(getDefaultLocale()).toBe('en');
    expect(getDefaultNamespace()).toBe('common');
    expect(getNamespaces()).toEqual(['common']);
  });

  it('memoises namespace-bound translators so callers receive stable references', async () => {
    vi.doMock(CONFIG_MODULE, () => ({
      DEFAULT_LOCALE: 'en',
      SUPPORTED_LOCALES: ['en', 'es', 'fr'],
      DEFAULT_NAMESPACE: 'common',
      NAMESPACES: ['common', 'marketing'],
      default: {
        defaultLocale: 'en',
        locales: ['en', 'es', 'fr'],
        defaultNamespace: 'common',
        namespaces: ['common', 'marketing'],
        load: ['server'],
      },
    }));

    const translatorCache = new Map<string, () => string>();
    getFixedTMock.mockImplementation((locale: string, namespace: string) => {
      const key = `${locale}:${namespace}`;
      if (!translatorCache.has(key)) {
        translatorCache.set(key, () => `${key}::translation`);
      }
      return translatorCache.get(key);
    });

    const { useTranslations } = await import('../../../src/i18n/index');

    const defaultTranslator = useTranslations();
    expect(defaultTranslator).toBe(useTranslations());
    expect(getFixedTMock).toHaveBeenCalledWith('en', 'common');

    const marketingTranslator = useTranslations('marketing', 'fr');
    expect(marketingTranslator('mock.key')).toBe('fr:marketing::translation');
    expect(marketingTranslator).toBe(useTranslations('marketing', 'fr'));
  });

  it('resolves the QA locale switcher flag across import.meta.env and process.env shims', async () => {
    const { isLocaleQASwitcherEnabled, PUBLIC_QA_LOCALE_SWITCHER_FLAG } = await import(
      '../../../src/utils/featureFlags'
    );

    expect(isLocaleQASwitcherEnabled({ [PUBLIC_QA_LOCALE_SWITCHER_FLAG]: 'true' }, undefined)).toBe(
      true,
    );

    expect(isLocaleQASwitcherEnabled({}, { [PUBLIC_QA_LOCALE_SWITCHER_FLAG]: 'ON' })).toBe(true);

    expect(isLocaleQASwitcherEnabled({}, {})).toBe(false);
  });
});
