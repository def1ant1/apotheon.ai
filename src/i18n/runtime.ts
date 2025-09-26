import { detectLocaleFromPath, localizePath, localizeUrl } from 'astro-i18next';

import { useTranslations as resolveTranslator } from './index';

import type { Translator as LegacyTranslator } from './translator';
import type { AstroGlobal } from 'astro';

type RuntimeTranslator = ReturnType<typeof resolveTranslator>;

const EMPTY_STRING = '';

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
    const result = translator(key, options as never);

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
  void astro;

  const translator = resolveTranslator();
  const legacyTranslator = createLegacyTranslator(translator);

  return Promise.resolve({
    t: legacyTranslator,
  });
}

export { detectLocaleFromPath, localizePath, localizeUrl };
