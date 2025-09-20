# Solutions Content Schema & Workflow

The dedicated solutions collection (`src/content/solutions/`) keeps product storytelling
fully structured so Astro templates render hydration-free sections in a consistent order.
Each entry is a Markdown or MDX file whose frontmatter must satisfy the schema defined in
`src/content/solutions/index.ts`.

## Required Frontmatter Fields

| Field             | Type                | Purpose                                                                             |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `title`           | `string`            | Human-readable page title rendered in metadata and hero headings.                   |
| `order`           | `number`            | Controls ordering on `/solutions`. Lower numbers render first.                      |
| `featured`        | `boolean`           | Toggles featured styling on the landing grid and hero outline.                      |
| `hero`            | `object`            | Contains `eyebrow`, `headline`, `copy`, and CTA metadata for the hero banner.       |
| `overview`        | `object`            | Supplies a summary paragraph and optional bullets rendered directly under the hero. |
| `keyFeatures`     | `array`             | Three or more feature bullets with optional quantitative evidence.                  |
| `howItWorks`      | `array`             | Ordered lifecycle steps with optional `duration` and `owner` metadata.              |
| `useCases`        | `array`             | Persona-focused scenarios including optional `outcome` proof points.                |
| `crossLinks`      | `array`             | Related resources surfaced as semantic list items with descriptive labels.          |
| `finalCta`        | `object`            | Closing CTA banner copy and button metadata.                                        |
| `seo.description` | `string` (optional) | Overrides the meta description; defaults to the overview summary.                   |
| `draft`           | `boolean`           | Draft entries are ignored by `getStaticPaths` and hidden from the index page.       |

## Authoring Workflow

1. **Duplicate an existing entry** to inherit inline editorial notes. Update all frontmatter
   fields; empty arrays will fail `npm run typecheck` because the templates expect every
   section to render.
2. **Keep CTA destinations relative** (`/about/contact/`, `/solutions/nova/`, etc.) so the
   navigation validator can confirm routes resolve within the static export.
3. **Run `npm run typecheck`** to validate the schema and `npm run lint` to ensure comments
   and copy adhere to repository conventions.
4. **Preview locally** via `npm run dev -- --host 0.0.0.0` and visit `/solutions/<slug>/` to
   confirm hero, overview, feature grid, lifecycle steps, use cases, cross-links, and the
   final CTA all render with the expected copy.
5. **Execute the release gate** before merging: `npm run lint`, `npm run typecheck`,
   `npm run test`, `npm run test:e2e`, `npm run build`, and `npm run ladle:build`.

## Editorial Guardrails

- Hero copy should remain two to three sentences to avoid overflow on smaller devices.
- `overview.bullets` reinforce the summary; keep each `label` under ~45 characters so the
  grid remains legible on tablet breakpoints.
- Provide at least three items for `keyFeatures`, `howItWorks`, `useCases`, and
  `crossLinks`. Playwright tests assert these sections render at scale.
- Cross-link labels must describe the destination ("Connect telemetry", "Review guardrails")
  rather than repeating the page title so screen readers convey intent.
- The final CTA should pitch the highest-intent next step (usually a contact form). Avoid
  duplicating hero CTAs to keep analytics funnels clean.

## Automation Notes

- Navigation validation now cross-checks `/solutions/*` routes against this collection so
  header/footer links never point to stale pages.
- Breadcrumb helpers use `createSolutionsEntryTrail()` to map `Home → Solutions → <Title>`
  without manual strings. If nested solution categories emerge, extend the helper and add
  fixture coverage alongside the change.
- Unit and end-to-end tests load these entries to ensure every section stays populated.
  Empty arrays or missing CTAs will cause Vitest or Playwright suites to fail.
