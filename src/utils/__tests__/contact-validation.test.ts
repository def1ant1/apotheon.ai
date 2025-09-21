import { describe, expect, it } from 'vitest';

import { contactFormSchema } from '../contact-validation';

describe('contact form validation', () => {
  const base = {
    name: 'Ada Lovelace',
    email: 'ada@apotheon.ai',
    company: 'Apotheon.ai',
    intent: 'demo' as const,
    message:
      'I would like to explore a pilot focused on proactive incident detection across our portfolio.',
    turnstileToken: 'token-abc1234567890',
  };

  it('accepts a well-formed payload', () => {
    const result = contactFormSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('rejects disposable domains', () => {
    const result = contactFormSchema.safeParse({
      ...base,
      email: 'founder@mailinator.com',
    });

    expect(result.success).toBe(false);
  });

  it('enforces message length expectations', () => {
    const result = contactFormSchema.safeParse({
      ...base,
      message: 'Too short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects when honeypot is populated', () => {
    const result = contactFormSchema.safeParse({
      ...base,
      honeypot: 'bot',
    });

    expect(result.success).toBe(false);
  });
});
