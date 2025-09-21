import { describe, expect, it } from 'vitest';

import { WHITEPAPER_SLUGS } from '../../generated/whitepapers.manifest';
import { whitepaperRequestSchema } from '../whitepaper-request';

describe('whitepaperRequestSchema', () => {
  const basePayload = {
    name: 'Avery Compliance',
    email: 'avery@exampleenterprise.com',
    company: 'Example Enterprise',
    role: 'Security Architect',
    justification:
      'We are preparing a board briefing on automation guardrails and need benchmark data.',
    whitepaperSlug: WHITEPAPER_SLUGS[0],
    marketingOptIn: true,
    turnstileToken: 'token-1234567890',
  } as const;

  it('accepts a valid payload', () => {
    const result = whitepaperRequestSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it('rejects requests for unknown whitepapers', () => {
    const result = whitepaperRequestSchema.safeParse({
      ...basePayload,
      whitepaperSlug: 'non-existent-whitepaper',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/does not exist/i);
    }
  });

  it('blocks disposable domains by default', () => {
    const result = whitepaperRequestSchema.safeParse({
      ...basePayload,
      email: 'user@gmail.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/corporate email/);
    }
  });
});
