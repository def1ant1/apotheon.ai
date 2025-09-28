import {
  type Locale,
  SUPPORTED_LOCALES,
  detectLocaleFromPath,
  localizePath,
  localizeUrl,
  getDefaultLocale,
  useTranslations as resolveTranslator,
} from './index';

import type { Translator as LegacyTranslator } from './translator';
import type { AstroGlobal } from 'astro';

type RuntimeTranslator = ReturnType<typeof resolveTranslator>;

const EMPTY_STRING = '';

/**
 * Materialising a `Set` upfront keeps locale validation O(1) even as the supported
 * catalogue expands. We lean on the integration constants so the helper stays in sync
 * with astro-i18next configuration updates without manual wiring.
 */
const SUPPORTED_LOCALE_REGISTRY = new Set<string>(SUPPORTED_LOCALES);

type LocaleHint = string | null | undefined;

interface AstroI18nextLocals {
  readonly locals?: {
    readonly i18next?: {
      readonly language?: unknown;
    };
  };
}

/**
 * Guards candidate locales to prevent surprise fallbacks when upstream middleware passes
 * arbitrary data. Returning a type predicate lets the downstream translator wiring remain
 * strongly typed without sprinkling non-null assertions across the call sites.
 */
function isSupportedLocale(candidate: LocaleHint): candidate is Locale {
  return typeof candidate === 'string' && SUPPORTED_LOCALE_REGISTRY.has(candidate);
}

/**
 * astro-i18next persists the active language on `Astro.locals` for middleware and downstream
 * integrations. Surfacing the lookup keeps the runtime bridge in lockstep with that contract
 * without forcing every caller to know the implementation details.
 */
function extractLocaleFromLocals(astro: AstroGlobal): LocaleHint {
  const locals = (astro as AstroI18nextLocals).locals;

  if (!locals || typeof locals !== 'object') {
    return undefined;
  }

  const { i18next } = locals;

  if (!i18next || typeof i18next !== 'object') {
    return undefined;
  }

  const { language } = i18next as { language?: unknown };

  return typeof language === 'string' ? language : undefined;
}

/**
 * Resolves the most appropriate locale for a given Astro request. We prioritise explicit
 * hints baked into the pathname so `/es/*` routes always receive Spanish copy. When the
 * URL omits locale cues we fall back to the astro-i18next language bag and ultimately the
 * integration’s canonical default. Centralising the heuristics here ensures the legacy
 * translator bridge mirrors astro-i18next’s behaviour everywhere else in the app.
 */
function deriveLocale(astro: AstroGlobal): Locale {
  const pathname = astro.url?.pathname ?? EMPTY_STRING;
  const localeFromPath = detectLocaleFromPath?.(pathname);

  if (isSupportedLocale(localeFromPath)) {
    return localeFromPath;
  }

  const localsLocale = extractLocaleFromLocals(astro);

  if (isSupportedLocale(localsLocale)) {
    return localsLocale;
  }

  return getDefaultLocale();
}

function getDefaultFallback(options?: Record<string, unknown>): string {
  if (!options || typeof options !== 'object') {
    return EMPTY_STRING;
  }

  const { defaultValue } = options as { defaultValue?: unknown };

  if (typeof defaultValue === 'string') {
    return defaultValue;
  }

  if (defaultValue === undefined || defaultValue === null) {
    return EMPTY_STRING;
  }

  if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
    return String(defaultValue);
  }

  return EMPTY_STRING;
}

function createLegacyTranslator(translator: RuntimeTranslator): LegacyTranslator {
  return (key, options) => {
    const result: unknown = translator(key, options as never);

    if (typeof result === 'string') {
      return result;
    }

    return getDefaultFallback(options);
  };
}

/**
 * Server-side bridge that mirrors the async signature expected by legacy astro-i18next helpers.
 * We lean on the synchronous translator in `src/i18n/index.ts` to avoid bundling the optional
 * package client helpers while keeping type safety intact.
 */
export function useTranslations(astro: AstroGlobal): Promise<{ readonly t: LegacyTranslator }> {
  const requestLocale = deriveLocale(astro);

  const translator: RuntimeTranslator = resolveTranslator(undefined, requestLocale);
  const legacyTranslator = createLegacyTranslator(translator);

  return Promise.resolve({
    t: legacyTranslator,
  });
}

export { detectLocaleFromPath, localizePath, localizeUrl };
