# Theme Visual Baseline Refresh — 2025-02-19

> **Context:** Fixture regeneration executed via the enterprise snapshot pipeline to realign the marketing, documentation, and lead viewer surfaces with the unified theme contract in `tests/e2e/theme-visual.contract.ts`. The run captures deterministic Playwright updates so CI diff noise stays near-zero while coverage expands across pre-production entry points.

## Command Stream

| Command                                | Notes                                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:e2e:update-theme-visual` | Boots the Astro dev server, exports the snapshot update env vars, calls `scripts/update-theme-visual-fixtures.ts`, and replays `tests/e2e/theme-visual.spec.ts` against the contract-driven matrix. |

## Route × Theme Coverage

| Route           | Slug                    | Themes          | Notes                                                                                          |
| --------------- | ----------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `/`             | `homepage`              | `light`, `dark` | Marketing hero, grid, and testimonial coverage safeguarding acquisition-critical templates.    |
| `/docs/`        | `docs-index`            | `light`, `dark` | Documentation shell navigation and search affordances validated under both palettes.           |
| `/lead-viewer/` | `lead-viewer-dashboard` | `light`, `dark` | RevOps dashboard chrome, table primitives, and auth prompts preserved for enterprise handoffs. |

## Artifacts Captured

- `tests/e2e/fixtures/theme-visual/homepage__light.base64.txt`
- `tests/e2e/fixtures/theme-visual/homepage__dark.base64.txt`
- `tests/e2e/fixtures/theme-visual/docs-index__light.base64.txt`
- `tests/e2e/fixtures/theme-visual/docs-index__dark.base64.txt`
- `tests/e2e/fixtures/theme-visual/lead-viewer-dashboard__light.base64.txt`
- `tests/e2e/fixtures/theme-visual/lead-viewer-dashboard__dark.base64.txt`

## Observability Notes

- `scripts/update-theme-visual-fixtures.ts` emits `[theme-visual] Updated <slug> (<theme>).` for every permutation, enabling quick verification in CI logs.
- Regeneration runs attach the Playwright HTML report under `playwright-report/`; archive the artifact for design review when significant UI deltas occur.
- When new marketing or dashboard shells are promoted, extend `THEME_VISUAL_ROUTES` first, regenerate fixtures via the command above, and append the new artifacts to this changelog before landing the pull request.
