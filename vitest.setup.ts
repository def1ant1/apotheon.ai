import { TextDecoder, TextEncoder } from 'node:util';

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest running under jsdom occasionally shims TextEncoder/TextDecoder with minimal polyfills that
// break esbuild invariants. Force the Node implementations to keep dependencies stable.
Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
});

afterEach(() => {
  cleanup();
});
