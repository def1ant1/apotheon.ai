# Marketing Information Architecture

Our marketing stack favors content-driven automation so teams scale storytelling without manually
wiring routes. Use this reference to understand how content collections, Astro templates, and shared
components cooperate during `npm run build`.

## Content Collections

- **Location:** `src/content/marketing/` organized into `solutions/`, `industries/`, and `about/`.
- **Schema:** Each MDX file uses the marketing collection schema defined in
  `src/content/config.ts` (`title`, `summary`, `heroCtaLabel`, `order`, `featured`).
- **Authoring Guidance:** Inline MDX comments inside every document describe hero usage, CTA
  wiring, and extensibility options (e.g., embedding MDX components). Keep the comments updated as
  templates evolve so new contributors know which layout slot each section targets.

## Page Templates

- **Dynamic routes:**
  - `src/pages/solutions/[product].astro`
  - `src/pages/industries/[sector].astro`
  - `src/pages/about/[page].astro`

  Each template calls `getCollection('marketing')`, filters by folder prefix, and feeds the MDX
  content into reusable marketing components. The routes are fully static—no client-side routing or
  hydration occurs outside optional islands authors may embed later.

- **Index routes:**
  - `src/pages/solutions/index.astro`
  - `src/pages/industries/index.astro`
  - `src/pages/about/index.astro`

  These pages render navigation grids and precompute breadcrumb arrays. When the breadcrumb helper
  ships, the same data can be forwarded without changing the collection authoring flow.

## Shared Components

- `src/components/marketing/MarketingShell.astro` centralizes metadata, breadcrumb rendering, and
  layout spacing. Use it to guarantee consistent SEO tags and document structure.
- `src/components/marketing/MarketingHero.astro` standardizes hero presentation with accessible
  button styling and copy length guidance.
- `src/components/marketing/MarketingCtaRow.astro` prevents duplicate CTA markup while outlining
  performance and analytics considerations.

## Homepage Product Stack Grid

- **Source of truth:** The product stack grid ships inside `src/content/homepage/landing.mdx` as the
  `modules` array. Follow the inline editorial contract to keep the BWCCUM → Themis → Mnemosyne →
  Hermes → Morpheus cadence intact.
- **Automation discipline:** Before editing module summaries or links, run `npm run ensure:whitepapers`
  so regenerated PDFs (FEDGEN oversight, Sovereign AI assurance, Strategic automation playbook)
  publish updated slugs into `assets/whitepapers/managed-assets.json`. Then execute `npm run lint`,
  `npm run typecheck`, and `npm run build` to let CI mirror the refresh.
- **Research hand-offs:** FEDGEN and Trace Synthesis references must point to the dossiers stored in
  `docs/research/`. These Markdown files document access policies, download automation, and
  investor-review cadence. Never link directly to R2 object URLs from marketing pages.
- **Analytics alignment:** ProductModulesSection.tsx emits data attributes that assume the module
  order in the MDX file. Any reorder requires updating analytics dashboards and the README table in
  the same commit to keep revenue reporting accurate.

## Research Dossiers

- `docs/research/FEDGEN.md` — Tracks the capital oversight briefing workflow, signed URL
  distribution cadence, and BWCCUM × Themis orchestration metrics investors see in PDFs.
- `docs/research/TRACE_SYNTHESIS.md` — Documents trace aggregation, consent packaging, and the
  Mnemosyne export hooks the homepage now references.

Future additions (e.g., testimonial sliders, pricing tables) should follow the same pattern: create a
component inside `src/components/marketing/`, annotate it thoroughly, and import it from page
templates instead of duplicating markup.

## Build & Validation Flow

Run the following commands before shipping marketing updates:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

`npm run build` exports static HTML for every marketing route, including new MDX entries, ensuring we
ship a CDN-ready artifact without manual intervention.
