# Theme visual baselines

This directory stores the base64-encoded PNG fixtures that power `tests/e2e/theme-visual.spec.ts`.
Every snapshot captures a `(route, theme)` combination so design changes across light/dark surfaces
can be reviewed without pulling binary assets into the repository.

## Regenerating baselines

1. Ensure the local stack can run Playwright end-to-end tests. You must install the project
   dependencies (`npm install`), fetch the Playwright browsers (`npx playwright install`), and
   provision system libraries (`npx playwright install-deps chromium`).
2. From the repository root run:
   ```bash
   UPDATE_THEME_VISUAL_BASELINES=1 npm run test:e2e -- tests/e2e/theme-visual.spec.ts
   ```
   The helper in `tests/e2e/utils/assertBase64Snapshot.ts` will automatically rewrite the fixtures
   with a prefixed comment block describing the route, theme, fixture path, and regeneration command.
3. Commit the updated `*.base64.txt` files and the Playwright report if relevant. During review,
   confirm that each header reflects the expected route/theme pairing and that the new base64 payloads
   match intentional UI changes.

## Review checklist

- Verify the comment header in each fixture matches the `(route, theme)` combination exercised by the
  spec so future diffs stay traceable.
- Use Playwright's HTML report to validate the screenshots before merging.
- If a baseline is missing, re-run the command above to allow the helper to seed the fixture.
