import { defineCollection, z, type CollectionEntry } from 'astro:content';

/**
 * Centralised list of program areas keeps editorial metadata consistent across the timeline UI,
 * Schema.org structured data, and future data exports (e.g., investor decks). Extend the tuple
 * when new categories emerge instead of sprinkling free-form strings throughout the repo.
 */
export const HISTORY_PROGRAM_AREAS = [
  'Research',
  'Platform',
  'Operations',
  'Go-to-market',
  'Governance',
  'Community',
] as const;

const programAreaEnum = z.enum(HISTORY_PROGRAM_AREAS);

/**
 * Media metadata is intentionally strict so the automation pipeline can validate SVG inputs and
 * provenance manifests without guessing file names. Editors only supply semantic information while
 * the build surfaces consistent rendering and accessibility affordances.
 */
const mediaSchema = z.object({
  /** File name (including extension) stored under `src/assets/history/`. */
  src: z
    .string()
    .min(1)
    .describe(
      'Relative file name resolved against src/assets/history/. The ensure-history-media script validates presence and provenance.',
    ),
  /** Plain-language description used for alt text and Schema.org image annotations. */
  alt: z.string().min(1).describe('Accessible alt text describing the historical media asset'),
  /** Optional caption rendered below the image for context and sourcing. */
  caption: z
    .string()
    .optional()
    .describe(
      'Short caption reinforcing provenance or additional context (renders below the media)',
    ),
  /** Optional credit string (people, organizations) surfaced alongside the caption. */
  credit: z
    .string()
    .optional()
    .describe(
      'Attribution line honoring the source, automatically appended to captions when present',
    ),
});

/**
 * History collection powers the about/history page and downstream knowledge bases. Each MDX file
 * maps to a single milestone so we can evolve the dataset without touching templates or resorting
 * to bespoke JSON feeders. The schema leans on Zod to keep sourcing discipline explicit and
 * discoverable in tooling.
 */
export const historyCollection = defineCollection({
  type: 'content',
  schema: z.object({
    /** Four-digit year when the milestone landed. */
    year: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .describe(
        'Calendar year associated with the milestone. Used for sorting + Schema.org output.',
      ),
    /** Headline rendered as card title + Schema.org name field. */
    headline: z
      .string()
      .min(1)
      .describe('Concise milestone headline surfaced in cards, skip links, and structured data'),
    /** Narrative summarising impact. Favor 1-2 short paragraphs; Markdown permitted via MDX body. */
    narrative: z
      .string()
      .min(1)
      .describe(
        'Primary narrative supporting the milestone. Markdown is rendered in the timeline card body.',
      ),
    /** Program area ensures we can cluster milestones by discipline in analytics + filters. */
    programArea: programAreaEnum.describe(
      'Program area taxonomy pulled into UI filters + JSON-LD. Extend HISTORY_PROGRAM_AREAS when new categories emerge.',
    ),
    /** Structured media metadata keeps asset automation deterministic. */
    media: mediaSchema,
    /** Draft toggle lets editors stage copy reviews without exposing milestones publicly. */
    draft: z
      .boolean()
      .default(false)
      .describe(
        'When true the milestone is omitted from builds, sitemap feeds, and JSON-LD payloads',
      ),
  }),
});

export type HistoryEntry = CollectionEntry<'history'>['data'];
