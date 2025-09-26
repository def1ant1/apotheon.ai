import type { AstroI18nextConfig } from 'astro-i18next';
import type { InitOptions } from 'i18next';

export const DEFAULT_LOCALE: 'en';
export const SUPPORTED_LOCALES: readonly ['en', 'es', 'fr'];
export const DEFAULT_NAMESPACE: 'common';
export const NAMESPACES: readonly ['common'];
export const sharedServerOptions: InitOptions;
export const filesystemBackend: InitOptions['backend'];
export const i18nextServerConfig: InitOptions;

declare const astroI18nextConfig: AstroI18nextConfig;
export default astroI18nextConfig;
