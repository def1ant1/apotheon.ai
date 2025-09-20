# Developer Workflows

Our front-of-house automation aims to eliminate manual checks. The commands below
wire together ESLint, Stylelint, Prettier, and Astro's type analysis so changes
stay production-ready on every commit.

## Install & Bootstrap

```bash
npm install          # Installs dependencies + Husky via the prepare script
npx husky install    # Re-installs hooks when cloning without running npm install
```

`npm install` runs the `prepare` script automatically, but running `npx husky install`
is a safe fallback after cloning from a shallow checkout.

## Authoring Loop

| Task                            | Command                | Notes                                                                          |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Lint all source code            | `npm run lint`         | Runs ESLint with Astro/TypeScript/MDX coverage and Stylelint for CSS/Tailwind. |
| JavaScript/TypeScript lint only | `npm run lint:eslint`  | Useful when iterating on script-heavy islands.                                 |
| Style-only lint                 | `npm run lint:styles`  | Parses `.astro` `<style>` blocks, CSS Modules, and standalone stylesheets.     |
| Format files                    | `npm run format`       | Applies Prettier with Astro + Tailwind class sorting plugins.                  |
| Check formatting                | `npm run format:check` | CI-friendly formatter verification.                                            |
| Type + content safety           | `npm run typecheck`    | Delegates to `astro check` for schema + TS validation.                         |
| Component docs (dev)            | `npm run ladle`        | Launches Ladle with global theming + decorators.                               |
| Component docs (build)          | `npm run ladle:build`  | Static export consumed by CI + artifact previews.                              |
| Full regression gate            | `npm run test`         | Lint → typecheck → Ladle CI (a11y + visual smoke tests).                       |

## SEO Automation Workflow

- `npm run build` orchestrates the Astro export, sitemap emission, robots.txt
  generation, Pagefind indexing, and the smoke verifier in a single command.
- `npm run build:static` runs only the Astro build when you need raw HTML without
  regenerating search/robots artifacts (for example, before diffing HTML).
- `npm run postbuild:seo` rewrites `dist/robots.txt` using the shared manifest;
  `APOTHEON_DEPLOY_ENV=preview` (or any non-production token) forces crawler
  blocks for staging builds.
- `npm run search:index` refreshes the Pagefind directory in place after content
  edits without rebuilding Astro.
- `npm run seo:verify` replays the smoke checks to ensure sitemap routes and the
  search index exist and match expectations.

## Error Page Testing

We treat error surfaces as first-class product experiences because they are the UI our customers
see during the most stressful incidents. Keep the following loop handy whenever the shared error
shell (`src/components/system/ErrorPageShell.astro`) or the `404`/`500` routes change.

1. `npm run build` – Generates the static `/404/index.html` and `/500/index.html` assets.
2. `npm run preview -- --host 0.0.0.0 --port 4321` – Serves the production build locally. The
   explicit host binding keeps the server reachable from containers and remote browsers.
3. Hit `http://localhost:4321/404/` and `http://localhost:4321/500/` in a browser or via `curl` to
   confirm copy, navigation, and styles render as expected.
4. In staging, use the CDN or hosting provider's preview URL to visit `/500/` and verify the
   platform-level rewrite is serving the static artifact. Capture screenshots for incident runbooks
   when making notable UX changes.
5. After validation, stop the preview server with `Ctrl+C` so the next command session can reuse the port.

-## Marketing Content Pipeline

- **Content collections:** Marketing MDX lives in `src/content/marketing` under `industries/` and `about/`, while structured solution content now resides in `src/content/solutions/`. The new schema (documented in [`docs/dev/SOLUTIONS.md`](./SOLUTIONS.md)) captures hero metadata, overview summaries, feature bullets, lifecycle steps, use cases, cross-links, and final CTA copy so the Astro templates stay hydration-free.
- **Solution inventory alignment:** Homepage product modules still deep link into the governance, observability, and automation solution entries (`governance-lakehouse`, `observability-fabric`, `automation-studio`). Keep the structured solution entries updated in tandem with homepage copy changes so `getStaticPaths` continues generating valid routes without manual intervention.
- **Author workflow:** Drop an MDX file into the appropriate folder, run `npm run typecheck` to verify schema compliance, and execute `npm run build` to regenerate the static routes. Index pages (`/solutions`, `/industries`, `/about`) automatically enumerate new entries and feed breadcrumb metadata to upcoming navigation helpers.
- **Reusable components:** Shared hero, CTA rows, and shell metadata live in `src/components/marketing/`. Follow the inline comments for SEO, accessibility, and performance guidance before extending any template.
- **Automation-first mindset:** The marketing pipeline avoids manual routing. Editors should not touch files under `src/pages/solutions/`, `src/pages/industries/`, or `src/pages/about/` unless evolving the templates for the entire section.
- **Homepage industries preview contract:** The homepage preview at `src/components/homepage/IndustriesPreview.astro` queries the `marketing` collection for `/industries/*` entries, so content authors update only the MDX files in `src/content/marketing/industries`. After shipping a new industry or adjusting ordering copy, run `npm run build` to regenerate the static site and refresh Pagefind indexes, then execute `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and a final `npm run build` to confirm automated checks and the regenerated search index all stay green before merging.

## Homepage Content Pipeline

- **Structured hero source:** Homepage messaging now lives in `src/content/homepage/landing.mdx`. Frontmatter fields match the schema in `src/content/homepage/index.ts`, and inline comments double as editorial guardrails. Update text, CTA URLs, or bullet proof points here without touching templates.
- **Pillars & modules:** The same MDX file sources `pillars` and `modules`. Keep pillar ordering aligned with GTM priority (analytics and slides reuse the sequence) and reference brand icon slugs without the `.svg` extension. Modules should map one-to-one with `/solutions/*` routes so the automated Vitest + Playwright checks continue to pass without additional fixtures.
- **Benefits grid:** `benefits` inside `landing.mdx` powers the ROI/security/learning/scalability cards surfaced under the hero. Rotate proof points quarterly and ensure each `metric` aligns with a RevOps-approved KPI. Vitest asserts semantic list markup while Ladle stories visualize responsive collapse—rebuild stories via `npm run ladle:build` after copy or token changes.
- **CTA banners:** The `ctaBanners` object manages lower-funnel investor/demo CTAs. Reuse the existing navigation contact metadata by leaving the `%officeHours%` token in place; the Astro components replace it with values from `footerContact`. Keyboard focus + activation are exercised in `tests/e2e/homepage-cta-banners.spec.ts`, so run `npm run test:e2e` before shipping copy or styling tweaks.
- **Media refresh loop:** `npm run ensure:homepage-hero-media` materializes a lightweight placeholder at `src/assets/homepage/hero-base.png` whenever no hero artwork exists. Designers can drop production-ready imagery in the same path and the generator will automatically skip regeneration so handcrafted assets stay intact. Reference the file name through `heroMedia.src` in the MDX frontmatter, run `npm run typecheck` to validate the schema, and execute `npm run build` so `@astrojs/image` regenerates AVIF/WebP derivatives.
- **Release gate:** After editing homepage content or artwork, rerun `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`, and `npm run ladle:build`. These commands now invoke the hero media guardrail automatically, exercise unit + E2E coverage for the component, rebuild static assets, and keep documentation artifacts in sync for downstream reviewers.

## Global Header & Navigation

- **Single entry point:** `src/components/navigation/SiteHeader.astro` renders the skip link, brand home link, and Radix dropdown for every route. Layouts import it once so Astro can hydrate the navigation island with a single `client:idle` directive instead of duplicating islands per page.
- **Data contract:** `navigationMenuGroups` lives alongside the React island (`src/components/islands/RadixNavigationMenu.tsx`). The header clones the export, resolves each link against `getCollection('marketing')`, and drops any entries that do not map to real content. Update the marketing collection or extend the validation helper before adding a new menu item so we never ship 404s.
- **Styling discipline:** Navigation styling is centralized in `src/styles/global.css` under the `navigation-*` namespace. When new layout requirements appear, extend those classes instead of bolting ad-hoc Tailwind utilities into pages.
- **QA workflow:** After tweaking header or menu data, run `npm run lint`, `npm run typecheck`, and `npm run test` locally. These commands catch hydration regressions, schema drift, and Ladle accessibility issues before CI.

### Mobile navigation QA loop

- **Install browsers once:** `npx playwright install --with-deps chromium` ensures the headless runner is ready on fresh machines or containers.
- **Manual focus audit:**
  1. `npm run dev -- --host 0.0.0.0 --port 43210` to mirror the Playwright config and keep ports predictable.
  2. Open the site at `http://localhost:43210/` using a responsive viewport (`375px` wide is our baseline) and activate the “Menu” button.
  3. Confirm the “Skip to navigation links” control receives focus, `Tab` once to reach the first link, and press `Escape` to ensure focus returns to the trigger.
  4. Click the backdrop to confirm the drawer collapses and `aria-expanded` resets to `false`.
- **Automated checks:**
  - `npm run test:unit` now includes `MobileNavigationDrawer` assertions that watch `aria-controls`, skip links, and focus restoration hooks.
  - `npm run test:e2e` runs the Playwright smoke test that opens the drawer, tabs through the stack, and verifies focus restoration on close.
- **Release checklist:** Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` before shipping navigation changes so desktop + mobile paths stay green together.

## Global Footer & Trust Signals

- **Single entry point:** `src/components/navigation/SiteFooter.astro` renders the footer across every layout. The component imports `global.css` indirectly via `BaseLayout`, so token updates cascade without per-page overrides.
- **Shared data contract:** Link columns hydrate from `getFooterColumns()` in `src/components/navigation/navigationData.ts`. The helper reuses `navigationMenuGroups` plus `astro:content` validation, so editing the marketing collection automatically updates both header and footer IA.
- **Legal + governance:** Policy links continue to live in `navigationData.ts`, while contact metadata now resides in `src/components/navigation/contactMetadata.ts` (re-exported from `navigationData.ts` for legacy imports). Update both files in tandem with the legal Astro pages to avoid broken routes. Commit notes should mention the effective policy date so compliance can reconcile release tags.
- **Automation alignment:** When changing footer data, rerun the full release gate—`npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`—to exercise navigation validation and ensure the static export remains consistent. The build step reindexes Pagefind and regenerates robots metadata, so we never ship stale search artifacts.

## Breadcrumb Automation

- **Central helpers:** `src/utils/breadcrumbs.ts` exposes section-aware factories (`createMarketingEntryTrail`, `createBlogPostTrail`, etc.) so templates never hand-build crumb arrays. When new IA nodes appear, add the section metadata to `SECTION_CONFIG`, expose a dedicated helper if needed, and capture a regression fixture in `src/utils/breadcrumbs.test.ts` before wiring the template.
- **Reusable component:** `src/components/navigation/Breadcrumbs.astro` renders both the accessible `<nav>` and synchronized JSON-LD. Pass collection-derived trails and (optionally) a `baseHref` when working in contexts without `Astro.site` configured.
- **Testing strategy:** `npm run test:unit` runs the Vitest suite validating JSON-LD payloads, aria labels, and representative trails for each section. Update or add fixtures alongside helper changes to keep automation honest.
- **Review checklist:** After editing breadcrumb logic, re-run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` so accessibility, schema, and build gates all stay green.

## Blog Content Pipeline

- **Collections + schema:** Blog MDX files live in `src/content/blog/`. Frontmatter fields (`title`, `description`, `publishDate`,
  `updatedDate`, `heroImage`, `heroImageAlt`, `tags`, `estimatedReadingMinutes`, `author`, `draft`) are type-checked by
  `src/content/config.ts`. Keep the inline comments shipped with each starter file—automation reads those lines during tooling
  upgrades to detect missing documentation and editorial guardrails.
- **Authoring flow:**
  1. Duplicate the production-ready example MDX file to inherit editorial comments.
  2. Update metadata and body copy. Run `npm run typecheck` to catch schema violations before opening a PR.
  3. Preview locally via `npm run dev` (drafts render automatically) or execute `npm run dev -- --drafts` when you want to mimic
     a production-like route map with drafts included. For static validation, run `npm run build -- --drafts` and `npm run preview`
     to serve the artifact before stakeholders review.
- **Publishing checklist:** Flip `draft` to `false`, verify hero artwork is in `/public/images/blog`, and re-run `npm run build`
  without the `--drafts` flag. CI only publishes entries with `draft: false`, ensuring the static export never leaks drafts.
- **Layout components:** Shared blocks (`AuthorBio`, `RelatedPosts`) reside in `src/components/blog/` with documented prop types.
  Extend these components instead of editing page templates to keep JSON-LD, SEO metadata, and automation hooks centralized.
- **Pagination + search roadmap:** `src/pages/blog/index.astro` slices results with a configurable page size and exports a
  reusable pagination object. When expanding to paginated routes or tag filters, reuse this state inside a new dynamic route
  (`src/pages/blog/[page].astro`) or Astro endpoint. This avoids duplicating sorting/filtering rules across multiple surfaces.
- **Detail pages:** `src/pages/blog/[slug].astro` resolves entries via `getEntryBySlug`, enforcing the `draft` gate at build time.
  JSON-LD article schema is injected automatically; when breadcrumb data is ready, extend the existing `Astro.head` push block
  rather than rewriting the template.
- **Editorial handbook:** Long-form guidance, including required frontmatter commentary and review stages, now lives in
  [`docs/dev/EDITORIAL.md`](./EDITORIAL.md). Keep that file current as our automation evolves.

## Pre-commit Automation

- Husky hooks run `lint-staged` to auto-fix staged files with ESLint, Stylelint,
  and Prettier.
- The commit message hook enforces Conventional Commit syntax via `commitlint`.
- To bypass hooks for emergency fixes, commit with `HUSKY=0 git commit ...` and
  open a follow-up issue documenting the deviation.

## Conventional Commits

We follow the [`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint)
standard. Example prefixes include `feat:`, `fix:`, `docs:`, and `chore:`.

## Troubleshooting

- **ESLint cannot find the config** – ensure you are running commands from the repo root.
- **Type-aware linting is slow** – install project dependencies before running
  `npm run lint`; the TypeScript compiler caches results between invocations.
- **Hooks did not run after cloning** – execute `npm install` or `npx husky install`
  to regenerate `.husky/_/husky.sh`.

## Radix UI Composition Workflow

- Install primitives with `npm install @radix-ui/react-*` so TypeScript inference and
  accessibility props stay intact. New dependencies belong in production
  `dependencies`, not `devDependencies`, because Astro islands bundle them for the
  client runtime.
- Keep Radix wrappers colocated under `src/components/islands/`. Each component
  should expose data-driven APIs (arrays/objects that describe menu items, tabs,
  accordions, etc.) to minimize future manual edits.
- Favor semantic Tailwind tokens over raw hex values. The Radix navigation menu
  consumes the shared `brand.primary` and `brand.secondary` colors plus the
  `shadow-navigation` presets defined in `tailwind.config.mjs`.
- Document hydration strategy directly inside Astro pages (`client:load`,
  `client:idle`, `client:visible`, etc.) so reviewers know why JavaScript is shipped.
- Capture additional lessons learned in this workflow guide or a sibling doc under
  `docs/dev/` whenever new primitives join the stack.

## Component Documentation (Ladle)

- **Why Ladle?** Lightweight React environment aligned with our Astro islands. Vite +
  SWC match production settings, ensuring story behavior mirrors deployed islands.
- **Global decorators:** `.ladle/components.tsx` imports `src/styles/global.css` and
  forwards Ladle’s theme toggle into our `data-theme` API. Stories render with identical
  tokens/typography without per-story imports.
- **Core commands:**
  - `npm run ladle` → starts the authoring server, binding to `0.0.0.0` for containerized
    dev environments.
  - `npm run ladle:build` → emits `dist/ladle` for artifact uploads and async reviews.
  - `npm run ladle:ci` → runs the build plus the Puppeteer + axe-core sweep defined in
    `scripts/ci/ladle-ci.mjs`. This is invoked automatically by `npm run test`.
- **Story patterns:** Place stories in `src/stories/`, import shared data exports (e.g.,
  `navigationMenuGroups`), and annotate usage with exhaustive notes. Rich guidance keeps
  partner teams from reverse-engineering implementation details.
- **Artifacts:** `dist/ladle/meta.json` enumerates story IDs. CI consumes this manifest to
  determine which routes to audit; do not delete it.
