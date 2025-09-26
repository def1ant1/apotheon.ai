/**
 * Shared translation helpers ensure we handle default fallbacks identically across server-rendered
 * Astro components and supporting data modules. Accepting a light-weight translator signature keeps
 * the dependency graph clean while allowing us to call directly into i18next's `t` helper whenever
 * it is available.
 */
export type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Resolve a translated string while gracefully falling back to the canonical English copy when a
 * locale override is unavailable. We always inject the `defaultValue` so i18next records missing
 * keys during localization audits without breaking rendering.
 */
export function translateWithFallback(
  t: Translator | undefined,
  key: string | undefined,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  if (!key || typeof key !== 'string' || key.length === 0 || !t) {
    return fallback;
  }

  const baseOptions = { defaultValue: fallback };
  const mergedOptions = options ? { ...options, ...baseOptions } : baseOptions;

  try {
    return t(key, mergedOptions);
  } catch (error) {
    console.warn('[i18n] Failed to resolve translation for %s: %o', key, error);
    return fallback;
  }
}
