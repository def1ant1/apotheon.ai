import { footerContact } from '../navigation/contactMetadata';

/**
 * Builds a sentence that mirrors the accessible description injected into CTA banners. Centralizing
 * the formatter keeps Astro, React test doubles, and Ladle stories aligned while letting
 * `footerContact` evolve in one place. The helper intentionally references the navigation metadata
 * so contact routing stays authoritative without manual duplication.
 */
export function formatContactReachability(context: string): string {
  const channels: string[] = [];

  if (footerContact.email) {
    channels.push(`email ${footerContact.email}`);
  }

  if (footerContact.phone) {
    channels.push(`phone ${footerContact.phone}`);
  }

  if (footerContact.officeHours) {
    channels.push(`office hours ${footerContact.officeHours}`);
  }

  const channelSummary = channels.join(', ');

  return `${context} team can be reached via ${channelSummary}.`;
}

export function injectOperationalHoursCopy(copy: string | undefined): string | undefined {
  if (!copy) {
    return copy;
  }

  const fallback = footerContact.officeHours ?? 'posted office hours';
  return copy.replace(/\{officeHours\}|%officeHours%/gu, fallback);
}
