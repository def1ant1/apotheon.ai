import type { AstroIntegration } from 'astro';

export interface PlausibleOptions {
  domain?: string;
  scriptSrc?: string;
  apiHost?: string;
  consentService?: string;
}

export default function plausible(options?: PlausibleOptions): AstroIntegration;
