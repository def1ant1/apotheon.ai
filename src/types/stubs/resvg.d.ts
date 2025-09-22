export interface ResvgFitToWidth {
  mode: 'width';
  value: number;
}

export interface ResvgOptions {
  fitTo?: ResvgFitToWidth;
  background?: string;
}

export interface RenderResult {
  asPng(): Uint8Array;
}

export declare class Resvg {
  constructor(svg: string, options?: ResvgOptions);
  render(): RenderResult;
}
