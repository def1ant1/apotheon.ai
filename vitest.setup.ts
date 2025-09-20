import { TextDecoder, TextEncoder } from 'node:util';

// Vitest running under jsdom occasionally shims TextEncoder/TextDecoder with minimal polyfills that
// break esbuild invariants. Force the Node implementations to keep dependencies stable.
Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
});
