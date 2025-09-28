import { TextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest running under jsdom occasionally shims TextEncoder/TextDecoder with minimal polyfills that
// break esbuild invariants. We wrap Node's implementation so it returns the same typed-array instance
// that jsdom exposes, keeping esbuild and downstream consumers happy without clobbering working globals.
class JsdomSafeTextEncoder extends NodeTextEncoder {
  encode(input) {
    const encoded = super.encode(input);
    const SandboxUint8Array = globalThis.Uint8Array;

    if (typeof SandboxUint8Array === 'function' && !(encoded instanceof SandboxUint8Array)) {
      return new SandboxUint8Array(encoded);
    }

    return encoded;
  }
}

if (
  typeof globalThis.TextEncoder === 'undefined' ||
  !(new globalThis.TextEncoder().encode('') instanceof globalThis.Uint8Array)
) {
  Object.assign(globalThis, { TextEncoder: JsdomSafeTextEncoder });
}

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder });
}

afterEach(() => {
  cleanup();
});
