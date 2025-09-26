# Homepage Governance

The homepage now sources hero, benefit, and CTA banner copy from
`src/content/homepage/landing.mdx`. This guide centralizes editorial guardrails so
marketing, RevOps, and investor relations can collaborate without reverse engineering
component implementations.

## Benefits Grid

- **Schema:** `benefits` is an array of objects (`title`, `proofPoint`, `metric`). The Zod
  schema lives in `src/content/homepage/index.ts` and enforces 3–6 entries.
- **Editorial rules:**
  - Titles should stay under ~35 characters to prevent wrapping on 320 px viewports.
  - Proof points should describe automated, repeatable workflows—avoid language that
    implies manual heroics.
  - Metrics must map to data vetted by RevOps. Update numbers quarterly and document
    the source system inside the PR description for auditability.
- **Automation:**
  - `npm run test` executes `PlatformBenefits.test.tsx`, validating semantic lists and
    aria labeling for the metric emphasis.
  - `npm run ladle:build` exports `homepage/platform-benefits` for async design reviews.
  - When adjusting Tailwind tokens, confirm contrast via the Ladle a11y report and
    rerun `npm run lint` so Stylelint snapshots capture the updates.

## CTA Banners

- **Schema:** `ctaBanners` contains `investor` and `demo` objects with `heading`, `body`,
  optional `secondaryText`, and nested `cta` metadata (`label`, `href`, `ariaLabel`).
- **Contact metadata:** Leave `%officeHours%` in the `secondaryText` template. The Astro
  components replace the token with `footerContact.officeHours`, and the shared
  `formatContactReachability` helper in `src/components/homepage/ctaContactNote.ts`
  injects the email + phone sourced from `src/components/navigation/contactMetadata.ts`
  into the accessible description.
- **Investor flow:** The investor CTA now routes to `/about/investors/` so visitors review
  the diligence context before hitting the contact form. Keep the `ariaLabel` focused on
  navigation semantics ("Navigate to…") instead of form submission language.
- **Accessibility + QA:**
  - Unit tests (`InvestorBanner.test.tsx`, `DemoBanner.test.tsx`) verify aria wiring and
    contact copy. Run `npm run test` whenever banner content changes.
  - Playwright coverage lives in `tests/e2e/homepage-cta-banners.spec.ts`; execute
    `npm run test:e2e` to ensure keyboard activation still navigates correctly.
  - The end-to-end investor journey is captured in `tests/e2e/investor-journey.spec.ts`.
    Run it whenever investor copy or routing changes to verify the contact form preselects
    the Investor relations intent.
  - Ladle stories (`homepage/cta-banners`) provide rapid visual diffing. Rebuild with
    `npm run ladle:build` after color or copy updates so reviewers have fresh artifacts.
- **Background guidance:** Gradients use slate + sky tokens to preserve 4.5:1 contrast.
  When experimenting with new palettes, validate via Tailwind's design tokens,
  rerun `npm run lint` (Stylelint) for token enforcement, and capture screenshots for
  investor compliance review.

## Release Checklist

After editing homepage benefits or CTA banners:

1. Update `landing.mdx` frontmatter with new copy.
2. Run `npm run lint`, `npm run typecheck`, and `npm run test` to exercise schema,
   unit, and accessibility coverage.
3. Execute `npm run test:e2e` to replay keyboard automation for the banners and
   validate the investor journey.
4. Finish with `npm run build` and `npm run ladle:build` so static + documentation
   artifacts stay in sync.
