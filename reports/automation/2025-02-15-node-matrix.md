# Automation Suite Audit — 2025-02-15

> **Context:** Regression audit executed via Node.js 20.19.4 (Active LTS) and Node.js 22.20.0 (Current) to validate Astro 5 migration readiness. Each command was run from a clean working tree with freshly generated homepage hero media to eliminate stale asset references.

## Command Matrix

| Runtime      | Command             | Status | Notes                                                                                                                                                                          |
| ------------ | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node 20.19.4 | `npm run lint`      | ❌     | ESLint fails on `src/stories/homepage/hero-media.stories.tsx` until the hero base asset is generated. Re-running after `npm run ensure:homepage-hero-media` resolves the path. |
| Node 20.19.4 | `npm run typecheck` | ❌     | `astro check` cannot import `@tailwindcss/vite`. Add the package (or gate its usage) to unblock.                                                                               |
| Node 20.19.4 | `npm run test:unit` | ❌     | Vitest startup stops on the same missing `@tailwindcss/vite` dependency.                                                                                                       |
| Node 20.19.4 | `npm run test:e2e`  | ❌     | Playwright web server bootstrap inherits the missing `@tailwindcss/vite` issue; whitepaper generation also needs `npx playwright install` in CI to download browsers.          |
| Node 20.19.4 | `npm run build`     | ❌     | Static build halts because `astro.config.mjs` depends on `@tailwindcss/vite`.                                                                                                  |
| Node 22.20.0 | `npm run lint`      | ✅     | Passes once hero media is materialised; Vale, icon lint, and Stylelint succeed.                                                                                                |
| Node 22.20.0 | `npm run typecheck` | ❌     | Same missing `@tailwindcss/vite` import chain.                                                                                                                                 |
| Node 22.20.0 | `npm run test:unit` | ❌     | Vitest startup blocked by `@tailwindcss/vite`.                                                                                                                                 |
| Node 22.20.0 | `npm run test:e2e`  | ❌     | Missing Vite plugin prevents Astro dev server from starting; Playwright browsers must be installed beforehand.                                                                 |
| Node 22.20.0 | `npm run build`     | ❌     | Astro build exits early because `@tailwindcss/vite` is absent.                                                                                                                 |

## Safety Net Gaps and Remediation Plan

- **Tailwind Vite Plugin Dependency:** The Astro 5 upgrade expects `@tailwindcss/vite` for first-party integration. Add it to `package.json` and ensure `astro.config.mjs` gracefully handles environments where Tailwind is disabled.
- **Playwright Browser Provisioning:** Both e2e tests and whitepaper generators require managed Playwright binaries. Pin a post-install hook (or CI bootstrap step) that runs `npx playwright install --with-deps` to avoid runtime fetches.
- **Deterministic Media Fixtures:** CI should pre-run `npm run ensure:homepage-hero-media` so stories relying on generated assets do not break linting. Alternatively, commit deterministic PNG fixtures to source control.
- **Python Imaging Dependency:** The hero renderer installs Pillow on the fly. Bake `pillow` into a dedicated virtual environment or document the requirement for reproducible results.

## Execution Transcript References

- Node 20 lint failure details: see terminal chunk `f48915`.
- Missing Tailwind Vite plugin across commands: refer to chunks `da809f`, `ec6ce0`, `baf690`, and `1d84a2`.
- Playwright browser install prompts during e2e/build flows: recorded in chunks `6edca7`, `baf690`, `3860a6`, and `1d84a2`.
- Node 22 lint, test, and build outputs: captured in chunks `6a0bd2`, `ac6e99`, `a89970`, and `8fcd41`.

> Next steps: once dependencies are added, rerun the full matrix under both Node runtimes and archive the resulting logs back into `reports/automation/`.
