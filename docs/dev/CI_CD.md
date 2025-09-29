# Continuous Integration Pipeline

The `CI` workflow codifies our enterprise readiness guardrails so every commit is
vetted for quality, security, and operational excellence. The workflow is
implemented in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) and
executes automatically for pull requests and pushes to `main`.

## High-level flow

1. **Matrix coverage for Node LTS.** We validate against Node.js 18 and 20 to
   surface compatibility issues before they reach production. The primary
   hardening steps (Lighthouse, ZAP, and Gitleaks) run on Node 20 to keep the
   runtime consistent with Cloudflare Workers.
2. **Dependency caching.** `actions/setup-node` primes the npm cache for faster
   feedback loops. Cache keys are derived from `package-lock.json` so upgrades
   automatically invalidate stale packages.
3. **Core quality gates.** Each job runs `npm ci`, `npm run lint`,
   `npm run typecheck`, `npm run test`, and `npm run build` in order. The
   bundled `npm run build` now wraps the Astro export, robots.txt generation,
   Pagefind indexing, and smoke verification so deployments always ship complete
   SEO artifacts. Playwright end-to-end coverage and visual baseline management
   follow the [testing workflow](./TESTING.md) so CI and local executions stay
   aligned.
4. **Extended assurance.** On the Node 20 shard we enforce Lighthouse
   performance budgets, perform an OWASP ZAP baseline scan, and execute Gitleaks
   secret detection. Their artifacts are uploaded for manual triage while
   failures block the pipeline by design.

## Performance budgets and Lighthouse

Lighthouse runs via `npm run lighthouse:ci`, which wraps `@lhci/cli` with the
strict budgets defined in [`lighthouserc.json`](../../lighthouserc.json). Key
metrics are tuned to protect Largest Contentful Paint (≤ 2.5s), Interaction to
Next Paint (≤ 200ms), Cumulative Layout Shift (≤ 0.1), and Total Blocking Time
(≤ 150ms). Budgets also limit script/image weight and third-party requests.

To adjust budgets:

- Update the relevant `timings`, `resourceSizes`, or `resourceCounts` entries in
  `lighthouserc.json`.
- Regenerate production-like builds locally (`npm run build`) and rerun
  `npm run lighthouse:ci`. The CLI writes new reports under `artifacts/lighthouse`.
- Commit both the configuration changes and any documentation updates describing
  the rationale for the relaxed/tightened targets.

## OWASP ZAP baseline scan

`npm run zap:baseline` starts an `astro preview` server, waits for it to stabilise,
then executes `zap-baseline.py` in the official Docker image. The scope is
restricted via [`zap-baseline.conf`](../../zap-baseline.conf) so only the static
preview hosted from `dist/` is crawled. The script emits HTML, JSON, and XML
reports in `artifacts/security/zap` and fails the build if ZAP reports high
severity issues.

When updating scan parameters:

- Adjust crawl depth or includes/excludes in `zap-baseline.conf`.
- Keep the preview port (`4321` by default) in sync with any configuration
  tweaks.
- Document any newly accepted risks inside this file and in the architecture
  decision records to maintain auditability.

## Secret scanning with Gitleaks

`npm run gitleaks:ci` shells into the `zricethezav/gitleaks` Docker image using
our curated configuration ([`.gitleaks.toml`](../../.gitleaks.toml)). The config
extends the upstream defaults and suppresses noisy generated directories while
retaining strict detection for source and documentation files. Any discovered
secrets will fail the pipeline; the redacted JSON report is stored under
`artifacts/security/gitleaks/report.json` for forensic review.

To tune allowlists or add bespoke rules, edit `.gitleaks.toml` and run the same
script locally. Always prefer targeted regexes over broad allowlists to avoid
masking legitimate leaks.

## SEO asset verification

`npm run build` runs Astro, regenerates `robots.txt`, reindexes Pagefind, and
executes `scripts/seo/verify-dist.mjs`. The verification script asserts that the
sitemap, robots directives, and search index exist and contain expected routes.
The resulting `dist/pagefind` directory is saved as a GitHub artifact, making it
easy to debug issues without re-running a full build.

## Artifact handling

Artifacts from Lighthouse, ZAP, Pagefind, and Gitleaks remain available for 14
days. When triaging a failure, download the relevant archive from the Actions UI
and review the bundled HTML/JSON reports.

## Running the pipeline locally

1. Install dependencies with `npm ci` (Node 18+).
2. Run the quality gates: `npm run lint`, `npm run typecheck`, `npm run test`,
   and `npm run build`.
3. (Optional but recommended) Execute the extended checks:
   - `npm run lighthouse:ci`
   - `npm run zap:baseline`
   - `npm run gitleaks:ci`

Refer to [docs/dev/TESTING.md](./TESTING.md) for Playwright snapshot refreshes
and troubleshooting guidance before pushing theme or layout changes—CI assumes
the light/dark fixtures are current when evaluating pull requests.

The ZAP and Gitleaks commands require Docker. The scripts emit clear error
messages when Docker is unavailable, but production CI must have Docker
installed. Lighthouse downloads a bundled Chromium via `@lhci/cli` for
consistent scoring.

## Cloudflare deployment prerequisites

The workflow already requests the GitHub OIDC token (`permissions.id-token:
write`) so that future deployment jobs can federate with Cloudflare without
long-lived credentials. When wiring deployment stages, provision the following
repository secrets or environment variables (names are placeholders):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME`
- `CLOUDFLARE_API_TOKEN` (if Workers deployments cannot yet use OIDC end-to-end)

Document any additional secrets or scopes in `docs/infra` to keep auditors in the
loop.
