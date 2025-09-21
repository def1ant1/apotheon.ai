import { z } from 'zod';

import { analyzeDomain } from './domain-allowlist';

const baseFields = {
  name: z
    .string()
    .min(2, 'Provide your name so the RevOps concierge can personalize outreach.')
    .max(120, 'Names longer than 120 characters are likely automated.'),
  email: z
    .string()
    .email('Use a valid business email so we can route the request appropriately.')
    .max(254, 'Email addresses longer than 254 characters are non-standard.'),
  company: z
    .string()
    .min(2, 'Share the organization you represent to speed up territory assignment.')
    .max(160, 'Company names longer than 160 characters raise automation concerns.'),
  intent: z
    .enum(['demo', 'partnership', 'media', 'careers', 'investor', 'support'])
    .default('demo'),
  message: z
    .string()
    .min(40, 'Add a few sentences describing your initiative or desired outcomes.')
    .max(5_000, 'Please trim the request below 5,000 characters.'),
  honeypot: z.string().max(0).optional(),
  sourceUrl: z.string().url('Source URL must be a valid absolute URL.').optional(),
  utm: z.record(z.string()).optional(),
} as const;

type SharedPayload = z.infer<z.ZodObject<typeof baseFields>>;

const honeypotRule = (payload: SharedPayload) => !payload.honeypot || payload.honeypot.length === 0;
const domainRule = (payload: SharedPayload) =>
  analyzeDomain(payload.email).classification !== 'block';

export const contactFormSchema = z
  .object({
    ...baseFields,
    turnstileToken: z
      .string()
      .min(10, 'Complete the verification challenge so we can accept the submission.')
      .optional(),
  })
  .refine(honeypotRule, {
    message: 'Automation detected.',
    path: ['honeypot'],
  })
  .refine(domainRule, {
    message: 'Use a corporate email address instead of a disposable inbox.',
    path: ['email'],
  });

export type ContactFormPayload = z.infer<typeof contactFormSchema>;

export const serverContactFormSchema = z
  .object({
    ...baseFields,
    turnstileToken: z
      .string({ required_error: 'Complete the verification challenge before submitting.' })
      .min(10, 'Turnstile token missing or malformed.'),
  })
  .refine(honeypotRule, {
    message: 'Automation detected.',
    path: ['honeypot'],
  })
  .refine(domainRule, {
    message: 'Use a corporate email address instead of a disposable inbox.',
    path: ['email'],
  });
