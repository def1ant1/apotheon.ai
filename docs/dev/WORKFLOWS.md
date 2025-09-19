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
