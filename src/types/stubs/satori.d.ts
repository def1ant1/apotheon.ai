import type { ReactElement } from 'react';

export interface SatoriFontConfig {
  name: string;
  data: Uint8Array;
  style?: string;
  weight?: number | string;
}

export interface SatoriOptions {
  width: number;
  height: number;
  fonts: SatoriFontConfig[];
  embedFont?: boolean;
}

declare const satori: (element: ReactElement, options: SatoriOptions) => Promise<string>;
export default satori;
