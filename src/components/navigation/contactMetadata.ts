import { translateWithFallback, type Translator } from '../../i18n/translator';

export interface FooterContact {
  readonly organization: string;
  readonly email: string;
  readonly phone: string;
  readonly addressLines: ReadonlyArray<string>;
  readonly officeHours: string;
}

const canonicalFooterContact = {
  organization: 'Apotheon.ai',
  email: 'hello@apotheon.ai',
  phone: '+1-206-555-0188',
  addressLines: ['2211 Meridian Avenue', 'Suite 500', 'Seattle, WA 98101'],
  officeHours: 'Mon–Fri, 8:00–18:00 PT',
} as const satisfies FooterContact;

/**
 * Contact details power the footer, CRM automation, and JSON-LD metadata. Localizing organization
 * labels and office hours through i18next keeps surfaced copy consistent without duplicating the raw
 * address, phone number, or email values that downstream integrations depend on.
 */
export function getFooterContact(t?: Translator): FooterContact {
  return {
    ...canonicalFooterContact,
    organization: translateWithFallback(
      t,
      'footer.contact.organization',
      canonicalFooterContact.organization,
    ),
    officeHours: translateWithFallback(
      t,
      'footer.contact.officeHours',
      canonicalFooterContact.officeHours,
    ),
  };
}

export { canonicalFooterContact as footerContactDefaults, canonicalFooterContact as footerContact };
