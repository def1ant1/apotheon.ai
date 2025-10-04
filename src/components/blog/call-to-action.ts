export interface BlogCtaLink {
  /**
   * Label surfaced to readers. Keep this concise and action oriented so we
   * preserve button sizing across translations.
   */
  readonly label: string;
  /**
   * Destination for the CTA. Relative URLs keep traffic inside the marketing
   * funnel while still allowing fully-qualified links for campaigns.
   */
  readonly href: string;
  /**
   * Optional rel attribute overrides for compliance hardening.
   */
  readonly rel?: string;
}

export interface BlogCallToAction {
  /**
   * Optional eyebrow text (e.g., “Download”) rendered above the heading.
   */
  readonly eyebrow?: string;
  /**
   * Core heading encouraging the next action.
   */
  readonly title: string;
  /**
   * Supporting copy clarifying value (limited to a short sentence).
   */
  readonly description?: string;
  /**
   * Primary link shown as a filled button.
   */
  readonly primary: BlogCtaLink;
  /**
   * Optional secondary link rendered as an outlined button.
   */
  readonly secondary?: BlogCtaLink;
}

interface NormalizedCtaLink {
  readonly label: string;
  readonly href: string;
  readonly rel: string;
}

interface NormalizedBlogCta {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly primary: NormalizedCtaLink;
  readonly secondary?: NormalizedCtaLink;
}

const CTA_REL_FALLBACK = 'noopener noreferrer';

function sanitizeText(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function normalizeLink(link: BlogCtaLink | undefined): NormalizedCtaLink | undefined {
  if (!link) {
    return undefined;
  }

  const label = sanitizeText(link.label);
  const href = sanitizeText(link.href);
  if (!label || !href) {
    return undefined;
  }

  const normalizedHref = href.toLowerCase();
  const blockedProtocols = ['javascript:', 'data:', 'vbscript:'];
  if (blockedProtocols.some((protocol) => normalizedHref.startsWith(protocol))) {
    return undefined;
  }

  const rel = sanitizeText(link.rel) ?? CTA_REL_FALLBACK;
  return { label, href, rel };
}

function normalizeBlogCta(cta: BlogCallToAction | undefined | null): NormalizedBlogCta | null {
  if (!cta) {
    return null;
  }

  const primary = normalizeLink(cta.primary);
  if (!primary) {
    return null;
  }

  const secondary = normalizeLink(cta.secondary);

  const eyebrow = sanitizeText(cta.eyebrow);
  const title = sanitizeText(cta.title);
  const description = sanitizeText(cta.description);

  if (!title) {
    return null;
  }

  return {
    eyebrow,
    title,
    description,
    primary,
    secondary,
  };
}

function buildLinkMarkup(link: NormalizedCtaLink, kind: 'primary' | 'secondary'): string {
  const baseClass =
    kind === 'primary'
      ? 'inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200'
      : 'inline-flex items-center justify-center rounded-full border border-sky-300 px-6 py-3 text-base font-semibold text-sky-200 transition hover:border-sky-200 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200';

  const dataAttribute = kind === 'primary' ? 'blog-cta-primary' : 'blog-cta-secondary';

  return `<a class="${baseClass}" data-qa="${dataAttribute}" href="${escapeHtml(link.href)}" rel="${escapeHtml(link.rel)}">${escapeHtml(link.label)}</a>`;
}

export function renderBlogCtaMarkup(cta: BlogCallToAction | undefined | null): string | null {
  const normalized = normalizeBlogCta(cta);
  if (!normalized) {
    return null;
  }

  const eyebrowMarkup = normalized.eyebrow
    ? `<p class="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300">${escapeHtml(normalized.eyebrow)}</p>`
    : '';
  const descriptionMarkup = normalized.description
    ? `<p class="text-base text-slate-300">${escapeHtml(normalized.description)}</p>`
    : '';
  const secondaryMarkup = normalized.secondary
    ? buildLinkMarkup(normalized.secondary, 'secondary')
    : '';

  return `\n    ${eyebrowMarkup}
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-col gap-3">
        <h2 id="blog-cta-heading" class="text-2xl font-semibold text-white">${escapeHtml(normalized.title)}</h2>
        ${descriptionMarkup}
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center md:justify-end">
        ${buildLinkMarkup(normalized.primary, 'primary')}
        ${secondaryMarkup}
      </div>
    </div>
  `;
}

export { normalizeBlogCta };
