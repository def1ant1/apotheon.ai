# Theme visual baselines

This directory stores the base64-encoded PNG fixtures that power `tests/e2e/theme-visual.spec.ts`.
Every snapshot captures a `(route, theme)` combination so design changes across light/dark surfaces
can be reviewed without pulling binary assets into the repository. The contract in
`tests/e2e/theme-visual.contract.ts` currently emits the following matrix:

- `/` → `homepage` (themes: `light`, `dark`) — Marketing hero, pricing grid, and testimonial modules.
- `/docs/` → `docs-index` (themes: `light`, `dark`) — Documentation shell navigation, search affordances, and typography ramps.
- `/lead-viewer/` → `lead-viewer-dashboard` (themes: `light`, `dark`) — Dashboard shell + authentication chrome for the RevOps handoff experience.

The docs and dashboard shells are part of the baseline contract so enterprise stakeholders can audit
knowledge base and admin surfaces alongside marketing routes without bespoke tooling.

## Regenerating baselines

1. Ensure the local stack can run Playwright end-to-end tests. You must install the project
   dependencies (`TAILWIND_DISABLE_OXIDE=1 npm install`), fetch the Playwright browsers
   (`npx playwright install --with-deps chromium`), and provision system libraries if required by your
   platform.
2. From the repository root run:
   ```bash
   npm run test:e2e:update-theme-visual
   ```
   The CLI in `scripts/update-theme-visual-fixtures.ts` now boots an Astro dev server on demand,
   preloads manifest assets, exports the snapshot update flags, and rewrites every fixture with a
   prefixed comment block describing the route, theme, fixture path, and regeneration command.
3. Commit the updated `*.base64.txt` files and the Playwright report if relevant. During review,
   confirm that each header reflects the expected route/theme pairing and that the new base64 payloads
   match intentional UI changes. Reference the regeneration log in
   [`reports/automation/2025-02-19-theme-visual-regeneration.md`](../../../reports/automation/2025-02-19-theme-visual-regeneration.md)
   to cross-check the matrix captured during the fixture refresh task before merging additional changes.

## Review checklist

- Verify the comment header in each fixture matches the `(route, theme)` combination exercised by the
  spec so future diffs stay traceable.
- Use Playwright's HTML report to validate the screenshots before merging.
- If a baseline is missing, re-run the command above to allow the helper to seed the fixture.
