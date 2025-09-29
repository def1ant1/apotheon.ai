# Theme visual baselines

These fixtures store base64-encoded PNG snapshots for each high-risk route and theme combination covered by `tests/e2e/theme-visual.spec.ts`. Keep the files committed to source control so CI can gate visual regressions without depending on binary artefacts.

## Updating baselines

1. Ensure the local development server renders the expected state for the target pages.
2. Run the Playwright suite in record mode to regenerate fixtures:
   ```sh
   UPDATE_THEME_VISUAL_BASELINES=1 npm run test:e2e -- tests/e2e/theme-visual.spec.ts
   ```
3. Review the diff for the touched `*.base64.txt` files and confirm the visual shifts are intentional before committing.
