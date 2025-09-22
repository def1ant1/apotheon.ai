import type { ReactElement } from 'react';

/**
 * Ambient module declarations for the OG worker dependencies. The worker
 * executes in a Node-compatible runtime during local testing, so we provide
 * minimal but type-safe signatures for the libraries we consume.
 */
declare module 'satori' {
  interface SatoriFontConfig {
    name: string;
    data: Uint8Array;
    style?: string;
    weight?: number | string;
  }

  interface SatoriOptions {
    width: number;
    height: number;
    fonts: SatoriFontConfig[];
    embedFont?: boolean;
  }

  const satori: (element: ReactElement, options: SatoriOptions) => Promise<string>;
  export type { SatoriFontConfig, SatoriOptions };
  export default satori;
}

declare module '@resvg/resvg-js' {
  interface ResvgFitToWidth {
    mode: 'width';
    value: number;
  }

  interface ResvgOptions {
    fitTo?: ResvgFitToWidth;
    background?: string;
  }

  interface RenderResult {
    asPng(): Uint8Array;
  }

  class Resvg {
    constructor(svg: string, options?: ResvgOptions);
    render(): RenderResult;
  }

  export { Resvg, ResvgOptions, RenderResult };
}
