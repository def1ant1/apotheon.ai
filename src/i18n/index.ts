import { detectLocaleFromPath, localizePath, localizeUrl } from 'astro-i18next';
import i18next, { getFixedT, type TFunction } from 'i18next';

import astroI18nextConfig, {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  SUPPORTED_LOCALES,
} from './i18next.server.mjs';

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Exporting the resolved configuration keeps downstream callers from reaching
 * into the `.mjs` module directly while still supporting advanced inspection in
 * tests or instrumentation hooks.
 */
export const RUNTIME_I18N_CONFIG = astroI18nextConfig;

const normaliseLocales = (locales: string[] | string | undefined): Locale[] => {
  const values = locales ?? SUPPORTED_LOCALES;
  return (Array.isArray(values) ? values : [values]);
};

const normaliseNamespaces = (namespaces: string[] | string | undefined): Namespace[] => {
  const values = namespaces ?? NAMESPACES;
  return (Array.isArray(values) ? values : [values]);
};

export const getAvailableLocales = (): Locale[] => normaliseLocales(astroI18nextConfig.locales);

export const getDefaultLocale = (): Locale =>
  (astroI18nextConfig.defaultLocale ?? DEFAULT_LOCALE);

export const getDefaultNamespace = (): Namespace =>
  (astroI18nextConfig.defaultNamespace ?? DEFAULT_NAMESPACE);

export const getNamespaces = (): Namespace[] => normaliseNamespaces(astroI18nextConfig.namespaces);

const assertInitialised = () => {
  if (!i18next.isInitialized) {
    throw new Error(
      'i18next has not been initialised yet. Ensure the astro-i18next integration is registered before calling useTranslations().',
    );
  }
};

/**
 * Returns a memoised translation function bound to the requested namespace and
 * locale. The helper defaults to the runtime configuration to keep component
 * usage terse while remaining fully type-safe.
 */
export const useTranslations = (
  namespace: Namespace = getDefaultNamespace(),
  locale: Locale = getDefaultLocale(),
): TFunction => {
  assertInitialised();
  return getFixedT(locale, namespace);
};

export { detectLocaleFromPath, localizePath, localizeUrl };
export { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES, SUPPORTED_LOCALES };
