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
| Full regression gate            | `npm run test`         | Aggregates linting + typecheck to mirror CI locally.                           |

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
