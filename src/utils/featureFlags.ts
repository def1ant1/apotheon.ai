import type { Locale } from '../i18n';

/**
 * Centralised feature flag utilities keep runtime toggles deterministic across SSG and
 * SSR paths. QA teams frequently need to light up instrumentation without exposing the
 * surface to production traffic, so we bias toward environment-driven flags that default
 * to hardened behaviours unless explicitly overridden.
 */
const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);

/**
 * Shared helper to coerce a stringified environment variable into a boolean. Accepts a
 * handful of truthy values to support local `.env` usage where developers frequently
 * switch between `1` and `true` while validating toggles. Anything else resolves to
 * `false` so production defaults remain locked down.
 */
export const coerceFlagToBoolean = (value: string | undefined | null): boolean => {
  if (!value) {
    return false;
  }

  return BOOLEAN_TRUE_VALUES.has(value.trim().toLowerCase());
};

/**
 * Env var consumed by QA to surface the locale switcher while keeping production builds
 * aligned with the default locale experience. Prefixing with `PUBLIC_` ensures Astro
 * exposes the toggle to both server-rendered routes and client islands when needed.
 */
export const PUBLIC_QA_LOCALE_SWITCHER_FLAG = 'PUBLIC_ENABLE_LOCALE_QA_SWITCHER' as const;

/**
 * Reads the QA locale switcher flag from whichever runtime context is available. Astro
 * injects `import.meta.env` during both SSR and the client bundle. For thoroughness we
 * also examine `process.env` so integration tests or bespoke CLI tooling can override
 * the behaviour without additional wiring.
 */
export const isLocaleQASwitcherEnabled = (
  importMetaEnv: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
  processEnv: Record<string, string | undefined> | undefined = typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : undefined,
): boolean => {
  const candidate =
    importMetaEnv?.[PUBLIC_QA_LOCALE_SWITCHER_FLAG] ?? processEnv?.[PUBLIC_QA_LOCALE_SWITCHER_FLAG];

  return coerceFlagToBoolean(candidate);
};

/**
 * Utility guard exported for future locale-aware features. It keeps island props typed so
 * hydration flows only receive locales the backend understands. Centralising the export
 * also makes it trivial to stub in unit tests.
 */
export const isSupportedLocale = (
  locale: string,
  supportedLocales: ReadonlyArray<Locale>,
): locale is Locale => supportedLocales.includes(locale);
