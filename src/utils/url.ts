/**
 * Lightweight origin comparator that gracefully handles string inputs and URL
 * objects. Keeping the logic here avoids sprinkling optional chaining and
 * defensive type checks throughout navigation utilities.
 */
export function isSameOrigin(candidate: URL | string, origin: string): boolean {
  const referenceOrigin = normalizeOrigin(origin);
  const candidateOrigin = normalizeOrigin(candidate);
  return Boolean(referenceOrigin && candidateOrigin && referenceOrigin === candidateOrigin);
}

function normalizeOrigin(value: URL | string): string | null {
  try {
    if (typeof value === 'string') {
      const base = typeof window !== 'undefined' ? window.location.origin : undefined;
      return new URL(value, base).origin;
    }

    return value.origin;
  } catch {
    return null;
  }
}
