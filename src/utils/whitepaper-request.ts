import { z } from 'zod';

import { analyzeDomain } from './domain-allowlist';
import { WHITEPAPER_SLUGS } from '../generated/whitepapers.manifest';

const slugSet = new Set(WHITEPAPER_SLUGS);

const baseFields = {
  name: z
    .string()
    .min(2, 'Share your name so we can attribute the audit trail correctly.')
    .max(120, 'Names longer than 120 characters are likely automated.'),
  email: z
    .string()
    .email('Provide a valid business email address to continue.')
    .max(254, 'Email addresses longer than 254 characters are non-standard.'),
  company: z
    .string()
    .min(2, 'List the organization you represent; procurement will cross-check the record.')
    .max(160, 'Company names longer than 160 characters raise automation concerns.'),
  role: z
    .string()
    .min(2, 'Share your functional role so RevOps can tailor follow-up sequencing.')
    .max(160, 'Roles longer than 160 characters are likely automation noise.'),
  justification: z
    .string()
    .min(40, 'Add context describing how you intend to apply the whitepaper guidance.')
    .max(2_000, 'Please keep the justification under 2,000 characters.'),
  whitepaperSlug: z
    .string()
    .min(1, 'Select a whitepaper from the catalog.')
    .refine((value) => slugSet.has(value), 'Requested whitepaper does not exist.'),
  marketingOptIn: z.boolean().default(false),
  sourceUrl: z.string().url('Provide an absolute URL when sending source metadata.').optional(),
  utm: z.record(z.string()).optional(),
  honeypot: z.string().max(0).optional(),
} as const;

type SharedPayload = z.infer<z.ZodObject<typeof baseFields>>;

const honeypotRule = (payload: SharedPayload) => !payload.honeypot || payload.honeypot.length === 0;
const domainRule = (payload: SharedPayload) =>
  analyzeDomain(payload.email).classification !== 'block';

export const whitepaperRequestSchema = z
  .object({
    ...baseFields,
    turnstileToken: z
      .string()
      .min(10, 'Complete the verification challenge before requesting a download.')
      .optional(),
  })
  .refine(honeypotRule, { message: 'Automation detected.', path: ['honeypot'] })
  .refine(domainRule, {
    message: 'Use a corporate email address; disposable inboxes are blocked by security policy.',
    path: ['email'],
  });

export type WhitepaperRequestPayload = z.infer<typeof whitepaperRequestSchema>;

export const serverWhitepaperRequestSchema = z
  .object({
    ...baseFields,
    turnstileToken: z
      .string({
        required_error: 'Complete the verification challenge before requesting the asset.',
      })
      .min(10, 'Turnstile token missing or malformed.'),
  })
  .refine(honeypotRule, { message: 'Automation detected.', path: ['honeypot'] })
  .refine(domainRule, {
    message: 'Use a corporate email address; disposable inboxes are blocked by security policy.',
    path: ['email'],
  });
