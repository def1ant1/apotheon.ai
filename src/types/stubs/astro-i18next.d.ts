declare module 'astro-i18next' {
  import type { AstroGlobal } from 'astro';
  import type {
    AstroI18next as RuntimeAstroI18next,
    AstroI18nextConfig,
    AstroI18nextOptions,
  } from 'astro-i18next/dist/types/types';

  export type DetectLocaleFromPath = (pathname: string) => string | undefined;
  export type LocalizePath = (path: string, locale: string) => string;
  export type LocalizeUrl = (url: string | URL, locale: string) => string;
  export type UseTranslations = (astro: AstroGlobal) => Promise<{
    readonly t: (...args: unknown[]) => string;
  }>;

  export const detectLocaleFromPath: DetectLocaleFromPath;
  export const localizePath: LocalizePath;
  export const localizeUrl: LocalizeUrl;
  export const useTranslations: UseTranslations;
  export function initAstroI18next(config: AstroI18nextConfig): void;
  export function createReferenceStringFromHTML(html: string): string;
  export function interpolate(
    template: string,
    variables: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): string;
  export type { RuntimeAstroI18next as AstroI18next, AstroI18nextConfig, AstroI18nextOptions };
  const integration: (options?: AstroI18nextOptions) => unknown;
  export default integration;
}
