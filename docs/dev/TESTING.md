# End-to-end testing & visual baselines

This runbook explains how we exercise the Playwright suite, keep the light/dark theme fixtures in sync with
intentional UI changes, and debug snapshot diffs without falling back to ad-hoc manual review. Follow the flow below
before touching the marketing surface or shipping new design tokens so the CI pipeline inherits deterministic pixels.

## Prerequisites

1. Install dependencies with Tailwind's Oxide engine disabled (keeps native builds reproducible across Linux/macOS):
   ```bash
   TAILWIND_DISABLE_OXIDE=1 npm install
   ```
2. Install the Playwright browser runtime that matches CI:
   ```bash
   npx playwright install --with-deps chromium
   ```
3. Ensure Docker is available when you plan to run the full `npm test` umbrella locally—other automation such as
   ZAP/Gitleaks depends on it.

> **Accessibility note:** Playwright automatically respects the `reduced-motion` media query because our helpers force it
> on navigation. Keep the OS preference aligned if you capture videos or run manual explorations alongside the suite.

## Running `npm run test:e2e`

`npm run test:e2e` executes the Playwright specs exactly as CI does. The `pretest:e2e` hook warms every prerequisite so we
start from a production-like environment:

- Regenerates OpenGraph, history, hero, and whitepaper assets.
- Seeds docs/handbook content and CMS defaults.
- Primes the Pagefind search index by running `tests/e2e/fixtures/seed-pagefind.mjs`.

The command surfaces an HTML report under `playwright-report/`. Open it via:

```bash
npx playwright show-report
```

so reviewers can inspect failures without re-running the suite.

## Updating theme baselines

Intentional visual tweaks to routes or tokens require refreshing the light/dark PNG fixtures that power
`tests/e2e/theme-visual.spec.ts`. Use the scripted workflow to minimise manual drift:

```bash
npm run test:e2e:update-theme-visual
```

The helper wraps `scripts/update-theme-visual-fixtures.ts` and automates the full lifecycle:

1. Runs the same `pretest:e2e` preparations listed above.
2. Installs the Playwright Chromium build if missing.
3. Boots an Astro preview on-demand, forces reduced motion, preloads manifest-declared assets, and waits for fonts/LCP
   candidates to settle so pixels stay deterministic.
4. Rewrites every `tests/e2e/fixtures/theme-visual/*.base64.txt` file with a banner describing the route, theme, fixture
   path, and the regeneration command that produced it.

Commit the refreshed fixtures alongside any dependent code changes. The diff will be textual base64 output; reviewers
should verify the header metadata matches the expected `(route, theme)` pair and optionally open the attached PNG from
Playwright's HTML report.

## Interpreting textual diffs

Visual fixtures are committed as UTF-8 text with line-wrapped base64 payloads. When a regression occurs the assertion
message includes:

- The affected route and theme.
- The relative fixture path.
- SHA-256 hashes for the expected and received payloads.
- The exact regeneration command.

Use `npx playwright show-report` to preview the generated PNG/fixture pair. You can also copy the base64 payload into
`base64 --decode` to inspect the image manually when CI surfaces the diff.

## Automation flags & overrides

The helpers expose enterprise-friendly toggles so batch updates can run unattended (CI, remote dev containers) without
forking scripts:

| Variable                      | Values    | Purpose                                                                                             |
| ----------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `PLAYWRIGHT_UPDATE_SNAPSHOTS` | `1`/unset | Rewrites fixtures instead of diffing (set automatically by `npm run test:e2e:update-theme-visual`). |
| `UPDATE_SNAPSHOTS`            | `1`/unset | Alias recognised for parity with upstream Playwright workflows.                                     |
| `PLAYWRIGHT_BASE_URL`         | URL       | Override the preview origin when targeting a remote host or reusing an existing dev server.         |

Set one of the snapshot flags to `1` to regenerate fixtures during bespoke automation (e.g., scheduled jobs). When unset,
the suite fails with actionable messaging and uploads the drifted assets for inspection.

## Link linting & content hygiene

`npm run lint:links` wraps the enterprise lychee binary so link hygiene runs alongside ESLint, Vale, and the other quality
gates. The script attempts to build a throwaway Astro dist bundle under `artifacts/link-check/dist` and then sweeps both the
generated HTML and the raw markdown sources. When the build pipeline is unavailable (missing Pillow, Playwright browsers,
etc.), the script gracefully skips the dist check and continues with markdown coverage so air-gapped machines still surface
broken references.

- **Offline by default.** The orchestrator injects `--offline` unless you pass `--online`. Remote link auditing is noisy inside
  hermetic CI, so use `npm run lint:links -- --online` when you explicitly want to exercise production URLs.
- **Artifact trail.** Results land in `artifacts/link-check/report.json`; commit or upload this file when auditors need
  evidence of the scan.
- **Astro CLI invocation.** The wrapper calls the `node_modules/.bin/astro` shim directly, so extend it with subcommands
  only (for example `['build', '--outDir', …]`). Passing a leading `astro` string double-prefixes the binary and breaks
  the static build.
- **Binary provisioning.** The vendored CLI lives under `vendor/lychee` and downloads its architecture-specific binary into
  `vendor/lychee/vendor/` during `npm install`. The executable is gitignored to satisfy the "no large binaries" policy, so
  pre-seed that directory before installing when you work completely offline. Set `APOTHEON_LYCHEE_ARCHIVE_URL` to an
  internal mirror, `APOTHEON_LYCHEE_ARCHIVE_PATH` to a pre-seeded tarball, or `APOTHEON_LYCHEE_SKIP_DOWNLOAD=1` once the
  binary is present. Use `HOMEPAGE_HERO_DISABLE_RENDER=1` when you do prime the static build to avoid Python/Pillow
  requirements.

## Troubleshooting deterministic captures

- **Manifest preload expectations.** Every route publishes `apotheon:preload-assets` and `apotheon:lcp-candidates`
  meta tags. If preloads change, re-run the baseline update so the helper can fetch the new assets before the screenshot.
  Missing or renamed manifest keys usually surface as partial renders or 404s in the HTML report.
- **Reduced-motion settings.** The test harness injects a zero-duration stylesheet and emulates the
  `prefers-reduced-motion` media query. If animations still leak into captures, verify no route-level CSS overrides the
  `__apotheon-reduced-motion-style__` rules.
- **Cache warming.** Pre-test hooks and the snapshot helper fetch every manifest-declared asset with `cache: 'reload'` to
  bust stale service-worker or browser caches. If CI snapshots differ from local output, confirm your environment can
  reach the CDN paths (firewall, VPN) and rerun `npm run test:e2e:update-theme-visual` to refresh fixtures from a clean
  state.

Still stuck? Attach the Playwright HTML report and hashed assertion output to the pull request so reviewers can help
triage without reproducing the failure locally.
