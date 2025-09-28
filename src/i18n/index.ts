import i18next, { getFixedT, type TFunction } from 'i18next';

import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES, SUPPORTED_LOCALES } from './metadata.mjs';

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type Namespace = (typeof NAMESPACES)[number];

const SUPPORTED_LOCALE_REGISTRY = new Set(SUPPORTED_LOCALES);

const isSupportedLocale = (candidate: string | undefined): candidate is Locale =>
  typeof candidate === 'string' && SUPPORTED_LOCALE_REGISTRY.has(candidate);

const normalisePath = (candidate: string): string => {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return '/';
  }

  return candidate.startsWith('/') ? candidate : `/${candidate}`;
};

export const detectLocaleFromPath = (pathname: string): Locale | undefined => {
  const normalised = normalisePath(pathname);
  const [, maybeLocale] = normalised.split('/');

  if (isSupportedLocale(maybeLocale)) {
    return maybeLocale;
  }

  return undefined;
};

const stripLocaleFromPath = (pathname: string): string[] => {
  const segments = normalisePath(pathname)
    .split('/')
    .filter((segment) => segment.length > 0);

  if (segments.length > 0 && isSupportedLocale(segments[0])) {
    return segments.slice(1);
  }

  return segments;
};

export const localizePath = (path: string, locale: Locale): string => {
  const segments = stripLocaleFromPath(path);
  const targetSegments = locale === DEFAULT_LOCALE ? segments : [locale, ...segments];
  const trailingSlash = normalisePath(path).length > 1 && normalisePath(path).endsWith('/');

  const basePath = targetSegments.length > 0 ? `/${targetSegments.join('/')}` : '/';

  if (trailingSlash && basePath !== '/') {
    return `${basePath}/`;
  }

  return basePath;
};

export const localizeUrl = (url: string | URL, locale: Locale): string => {
  const target = typeof url === 'string' ? url : url.toString();

  try {
    const parsed = new URL(target);
    parsed.pathname = localizePath(parsed.pathname, locale);
    return parsed.toString();
  } catch {
    // Relative URLs (e.g., `/docs`) are resolved against a dummy origin to keep behaviour stable.
    const parsed = new URL(target, 'http://localhost');
    parsed.pathname = localizePath(parsed.pathname, locale);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
};

/**
 * Exporting the resolved configuration keeps downstream callers from reaching
 * into the `.mjs` module directly while still supporting advanced inspection in
 * tests or instrumentation hooks.
 */
export const RUNTIME_I18N_CONFIG = {
  defaultLocale: DEFAULT_LOCALE,
  locales: SUPPORTED_LOCALES,
  namespaces: NAMESPACES,
  defaultNamespace: DEFAULT_NAMESPACE,
  trailingSlash: 'ignore',
} as const;

export const getAvailableLocales = (): Locale[] => [...SUPPORTED_LOCALES];

export const getDefaultLocale = (): Locale => DEFAULT_LOCALE;

export const getDefaultNamespace = (): Namespace => DEFAULT_NAMESPACE;

export const getNamespaces = (): Namespace[] => [...NAMESPACES];

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

export { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES, SUPPORTED_LOCALES };
