# Theme visual baselines

This directory stores the base64-encoded PNG fixtures that power `tests/e2e/theme-visual.spec.ts`.
Every snapshot captures a `(route, theme)` combination so design changes across light/dark surfaces
can be reviewed without pulling binary assets into the repository.

## Regenerating baselines

1. Ensure the local stack can run Playwright end-to-end tests. You must install the project
   dependencies (`TAILWIND_DISABLE_OXIDE=1 npm install`), fetch the Playwright browsers
   (`npx playwright install --with-deps chromium`), and provision system libraries if required by your
   platform.
2. From the repository root run:
   ```bash
   npm run update:theme-visual
   ```
   The CLI in `scripts/update-theme-visual-fixtures.ts` now boots an Astro dev server on demand,
   preloads manifest assets, exports the snapshot update flags, and rewrites every fixture with a
   prefixed comment block describing the route, theme, fixture path, and regeneration command.
3. Commit the updated `*.base64.txt` files and the Playwright report if relevant. During review,
   confirm that each header reflects the expected route/theme pairing and that the new base64 payloads
   match intentional UI changes.

## Review checklist

- Verify the comment header in each fixture matches the `(route, theme)` combination exercised by the
  spec so future diffs stay traceable.
- Use Playwright's HTML report to validate the screenshots before merging.
- If a baseline is missing, re-run the command above to allow the helper to seed the fixture.
