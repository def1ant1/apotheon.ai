/// <reference types="@cloudflare/workers-types" />

/**
 * Shared utilities for the synthetic health monitoring pipeline. Exporting the constants keeps the
 * request signing contract aligned across the exercising Worker and the API entry points that honor
 * the bypass. Extensive comments act as inline runbooks so future contributors do not have to chase
 * docs to understand why the signing primitive exists.
 */
const globalScope = globalThis as typeof globalThis & {
  btoa?: (data: string) => string;
  atob?: (data: string) => string;
};

const maybeBuffer = (
  globalThis as {
    Buffer?: {
      from: (input: string, encoding?: string) => { toString: (encoding?: string) => string };
    };
  }
).Buffer;

if (typeof globalScope.btoa === 'undefined' && typeof maybeBuffer !== 'undefined') {
  globalScope.btoa = (data: string) => maybeBuffer.from(data, 'binary').toString('base64');
}

if (typeof globalScope.atob === 'undefined' && typeof maybeBuffer !== 'undefined') {
  globalScope.atob = (data: string) => maybeBuffer.from(data, 'base64').toString('binary');
}

const encoder = new TextEncoder();

const SYNTHETIC_SIGNATURE_HEADER = 'x-apotheon-synthetic-signature';
const SYNTHETIC_TIMESTAMP_HEADER = 'x-apotheon-synthetic-timestamp';
const SYNTHETIC_NONCE_HEADER = 'x-apotheon-synthetic-nonce';
const SYNTHETIC_CHECK_HEADER = 'x-apotheon-synthetic-check';
const SYNTHETIC_RUN_ID_HEADER = 'x-apotheon-synthetic-run-id';

const CONTACT_CHECK_IDENTIFIER = 'contact';
const WHITEPAPER_CHECK_IDENTIFIER = 'whitepapers';

const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => typeof key === 'string')
      .sort(([a], [b]) => a.localeCompare(b));

    const serialized = entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(',');

    return `{${serialized}}`;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString(10) : 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (value === null || typeof value === 'undefined') {
    return 'null';
  }

  return JSON.stringify(value);
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = (globalScope.atob ?? atob)(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = base64ToUint8Array(a);
  const bufferB = base64ToUint8Array(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < bufferA.length; index += 1) {
    mismatch |= bufferA[index] ^ bufferB[index];
  }

  return mismatch === 0;
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return (globalScope.btoa ?? btoa)(binary);
}

async function deriveSignature(
  secret: string,
  check: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
): Promise<string> {
  const material = `${check}|${timestamp}|${nonce}|${canonicalize(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(material));
  return toBase64(digest);
}

async function verifySignature(
  secret: string,
  signature: string,
  check: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
): Promise<boolean> {
  const expected = await deriveSignature(secret, check, timestamp, nonce, payload);
  return timingSafeEqual(signature, expected);
}

function isTimestampFresh(
  timestamp: string,
  toleranceMs = DEFAULT_CLOCK_SKEW_TOLERANCE_MS,
): boolean {
  const parsed = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  const delta = Math.abs(Date.now() - parsed);
  return delta <= toleranceMs;
}

export {
  CONTACT_CHECK_IDENTIFIER,
  WHITEPAPER_CHECK_IDENTIFIER,
  SYNTHETIC_SIGNATURE_HEADER,
  SYNTHETIC_TIMESTAMP_HEADER,
  SYNTHETIC_NONCE_HEADER,
  SYNTHETIC_CHECK_HEADER,
  SYNTHETIC_RUN_ID_HEADER,
  deriveSignature as createSyntheticSignature,
  verifySignature as verifySyntheticSignature,
  canonicalize,
  isTimestampFresh,
};
