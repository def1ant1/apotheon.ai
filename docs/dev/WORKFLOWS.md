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

## Marketing Content Pipeline

- **Content collections:** Marketing MDX lives in `src/content/marketing` under `solutions/`, `industries/`, and `about/`. Each file only needs the existing schema fields (`title`, `summary`, `heroCtaLabel`, `order`, `featured`), and richly commented sections describe which Astro layout slots they target. New files are auto-discovered by the dynamic routes created in `src/pages/solutions/[product].astro`, `src/pages/industries/[sector].astro`, and `src/pages/about/[page].astro`.
- **Author workflow:** Drop an MDX file into the appropriate folder, run `npm run typecheck` to verify schema compliance, and execute `npm run build` to regenerate the static routes. Index pages (`/solutions`, `/industries`, `/about`) automatically enumerate new entries and feed breadcrumb metadata to upcoming navigation helpers.
- **Reusable components:** Shared hero, CTA rows, and shell metadata live in `src/components/marketing/`. Follow the inline comments for SEO, accessibility, and performance guidance before extending any template.
- **Automation-first mindset:** The marketing pipeline avoids manual routing. Editors should not touch files under `src/pages/solutions/`, `src/pages/industries/`, or `src/pages/about/` unless evolving the templates for the entire section.

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
