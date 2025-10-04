# Apotheon.ai Web Platform

<div align="center">

<strong>Secure, Static-First Enterprise Hub for AI Documentation &amp; Marketing</strong>

[![Astro Static Platform](https://img.shields.io/badge/Astro-Static%20Sites-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Tailwind Utility System](https://img.shields.io/badge/Tailwind-Design%20Tokens-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GitHub Repo stars](https://img.shields.io/github/stars/apotheon-ai/apotheon.ai?style=social)](https://github.com/apotheon-ai/apotheon.ai)

<em>Zero-trust posture, automation-first operations, and obsessive documentation keep this marketing + documentation hub pre-production ready.</em>

<p align="center"><strong>Baseline:</strong> Astro 5 + Vite 6, validated against Node.js 20 LTS and Node.js 22 Current with automation guardrails described below.</p>

</div>

> **Enterprise note:** Everything in this repository assumes regulated-industry baselines—explicit automation, immutable audit trails, and static-first delivery to minimize operational variance.

## Platform Overview

<!-- Metric refresh instructions: regenerate the investor KPI snapshots that feed this table by running `npm run ensure:whitepapers && npm run test && npm run build` **after** every research MDX update; the whitepaper ensure step re-hydrates PDFs while the full test/build pipeline re-emits automation reports so the README summaries stay in lockstep for deterministic diffs. -->
<!-- Automation parity guardrail: anytime you add a new platform primitive, extend `scripts/content/ensure-whitepapers.ts` first so build hooks hydrate the associated asset before updating this matrix; editing the README without the automation step causes production deploys to fail the `ensure:whitepapers` contract tests. -->

| Platform primitive                                                     | Real-world use case                                                                                                                                         | Integrated orchestration                                                                                                                              | Linked research & whitepapers                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BWCCUM™ (Bi-directional Workflow & Capacity Control Utility Mesh)** | Multiregion underwriting desks that must stage GPU-intensive due diligence, sync SOC attestations, and replay prior approvals during regulator spot-audits. | Automates DAG policy sequencing with Themis so each underwriting batch inherits current controls before execution.                                    | [FEDGEN capital oversight briefing](docs/research/FEDGEN.md) → request `fedgen-operational-oversight.pdf` via `npm run ensure:whitepapers`; [Trace Synthesis field study](docs/research/TRACE_SYNTHESIS.md).                                             |
| **Themis Governance Control Plane**                                    | Sarbanes-Oxley and DORA compliance teams validating algorithmic change logs alongside human approvals.                                                      | Anchors BWCCUM event hooks, emitting audit packets to Mnemosyne for downstream consent proof and sending policy drift signals back to Nova analytics. | [Sovereign AI assurance deck](https://apotheon.ai/about/white-papers/?whitepaperSlug=sovereign-ai-assurance#whitepaper-request) (auto-generated) and quarterly compliance retrospectives in [`reports/automation/`](reports/automation/).                |
| **Mnemosyne Activation Fabric**                                        | Consent-aware growth campaigns where financial institutions blend first-party telemetry with partner datasets without breaching residency laws.             | Receives anonymized traces from BWCCUM while Themis enforces jurisdiction gating, and pushes only approved segments into Nova activation jobs.        | [Strategic automation playbook](https://apotheon.ai/about/white-papers/?whitepaperSlug=strategic-automation-playbook#whitepaper-request) plus the [Trace Synthesis drift appendix](docs/research/TRACE_SYNTHESIS.md#drift-appendix-automation-contract). |
| **Nova Insight Engine**                                                | Portfolio monitoring teams correlating model telemetry, cost curves, and human-in-the-loop escalations to steer quarterly investor guidance.                | Ingests BWCCUM runtime metrics and Themis policy deltas to regenerate predictive guardrails that Mnemosyne distributes across downstream teams.       | [Investor performance snapshots](https://apotheon.ai/about/white-papers/?whitepaperSlug=apotheon-investor-brief#whitepaper-request) and the [FEDGEN signal taxonomy](docs/research/FEDGEN.md#signal-taxonomy-custody).                                   |

> **BWCCUM ↔ Themis orchestration highlight:** Themis owns the compliance DAG definition, but BWCCUM executes it in-region with deterministic scheduling. A failed attestation automatically routes to Themis’ remediation queues, pauses the affected BWCCUM lanes, and triggers Nova forecast recalibration so investor metrics stay trustworthy without manual paging.

## Quick Start

> **Onboarding tip:** These commands intentionally mirror the CI pipeline so that every workstation matches production expectations. Stick to the sequence; each step caches work for the next one.

### 1. Provision the toolchain (one-time per workstation)

- Install **Node.js 20.x or 22.x** and **npm ≥ 9**. Pin versions via `asdf`, `nvm`, or your preferred fleet manager so upgrades stay coordinated across teams.
- Trust the automation helpers by running `npm install` once—this bootstraps Husky hooks, caches Vale binaries, and generates local assets (OG images, hero media, CMS configs).
- If you support air-gapped networks, mirror the `npm` cache per [infrastructure guidance](docs/infra/ALTERNATIVES.md) to keep supply chains deterministic.

```bash
npm install
```

### 2. Iterate locally with the enterprise dev server

```bash
npm run dev              # Starts Astro with hot reload + React island hydration
npm run dev:https        # Same as above but with mkcert-issued TLS for CSP parity
```

> **Instrumentation note:** The HTTPS variant auto-discovers the certificates minted by `./scripts/security/mkcert-localhost.sh` and emits nonce-based CSP headers so you can rehearse prod constraints.

### 3. Run quality gates continuously

```bash
npm run lint             # ESLint + Stylelint + Vale + diagram/icon checks (mirrors CI)
npm run typecheck        # Astro check keeps content collections and TS types in sync
npm run test:unit        # Vitest suite for islands, workers, and utilities
npm run test:e2e         # Playwright smoke coverage for investor-critical funnels
npm run test:e2e:update-theme-visual
                         # Refreshes light/dark visual baselines via the CLI then replays the spec
```

> **Automation note:** `npm run test` orchestrates the full stack (lint → typecheck → unit → Ladle CI → SEO monitor → synthetic worker tests). Use it before every PR to avoid rework.

### Astro 5 automation guardrails

> **Why this matters:** Astro 5 promotes the Tailwind integration to a dedicated Vite plugin and tightens SSR hooks, so automation must provision new dependencies before CI/CD runs.

- **Tailwind Vite plugin:** Ensure `@tailwindcss/vite` is installed wherever `astro.config.mjs` executes. Missing the plugin will break `astro check`, Vitest, Playwright, and `astro build`.
- **Playwright browser provisioning:** Run `npx playwright install --with-deps` (or leverage the CI bootstrap job) before invoking `npm run test:e2e` or the whitepaper generators. This prevents runtime downloads that otherwise fail in restricted networks.
- **Theme visual baselines:** Use `npm run test:e2e:update-theme-visual` whenever UI changes intentionally shift the light/dark snapshots. The helper shells into `scripts/update-theme-visual-fixtures.ts`, exports `PLAYWRIGHT_UPDATE_SNAPSHOTS=1`, and re-runs the Playwright spec so local runs and CI stay identical.
- **Deterministic media fixtures:** Execute `npm run ensure:homepage-hero-media` (part of every `pre*` script) so ESLint and Storybook stories find the generated hero assets. Consider committing the rendered PNG if your CI cannot run Python Pillow.
- **Python prerequisites:** The hero renderer installs Pillow dynamically. For hermetic builds, bake a virtualenv with `pillow` into your container image or document the requirement in fleet AMIs.
- **Audit trail:** Full Node 20/22 results live in [`reports/automation/2025-02-15-node-matrix.md`](reports/automation/2025-02-15-node-matrix.md); reference it after dependency updates to confirm guardrails remain intact.

### 4. Build and inspect production artifacts

```bash
npm run build            # Static render + compression + sitemap + hreflang + robots + Pagefind index + SEO verification
npm run preview          # Serves the production bundle with asset headers and CSP enforced
```

> **Performance note:** The build command chains through diagrams, OG images, and recommendation models so nothing ships stale. Keep the step intact for deterministic releases.

### 5. Deploy on fully managed edges

- **Cloudflare Pages (recommended):** Connect the repo, set `NODE_VERSION=20` (or `22` once your fleet standardises there) and `NPM_FLAGS=--legacy-peer-deps` if corporate proxies interfere, then let Pages run `npm run build` automatically.
- **Netlify / Vercel / S3 + CloudFront:** Point the build command to `npm run build` and publish the generated `dist/` directory. Preserve the generated headers from `astro.config.mjs` for CSP correctness.
- **Workers assets:** Execute `npm run workers:deploy` after Pages completes; the script auto-discovers worker environments and syncs secrets via Wrangler.

> **Reliability note:** Backups run through `npm run ops:backup:dry-run` to validate D1 + R2 exports before production rollouts.

## Features

- **Static-first Astro foundation** — Every marketing and documentation page pre-renders, then hydrates React islands only where necessary for accessibility-critical interactions.
- **Tailwind + Radix design system** — Centralized tokens in `tailwind.config.mjs` and Radix wrappers (see `src/components/islands/`) unlock enterprise theming without bespoke utility drift.
- **Search + personalization automation** — `npm run build` regenerates Pagefind indexes and blog recommendation models, ensuring investors and analysts land on fresh, relevant content with zero manual steps.
- **Security-first workflows** — mkcert-driven HTTPS, CSP enforcement, Workers rate limiting, and Vale-driven content linting all run by default to satisfy regulated-industry audits.
- **Extensive runbooks** — Architecture decisions, incident response guides, and brand governance live under `/docs` with direct callouts from the README so new hires never chase tribal knowledge.

> **Planning sync:** Track shipped increments and upcoming automation-first work in the [ROADMAP](ROADMAP.md) so every team references the same delivery narrative as they prioritize features.

> **Where to dive deeper:** Start with the [Architecture Decision Ledger](docs/architecture/DECISIONS.md), inspect the [system context diagram](docs/architecture/system-context.svg), then review the [brand style guide](docs/brand/STYLEGUIDE.md) before editing UI.

## Prefetch navigation telemetry

> **Privacy & automation note:** The navigation telemetry shipped under `src/utils/navigation/prefetch-telemetry.ts` only records aggregate, anonymized deltas between navigation start and time-to-first-byte (TTFB). Individual visitors, query strings, and unique identifiers never leave the browser; instead, the controller batches sanitized histograms per route and sends them through the analytics proxy only once consent, Do-Not-Track, and Global Privacy Control checks pass.

- **Histogram schema:** Each batch serializes as:

  ```jsonc
  {
    "version": 1,
    "recordedAt": "2025-03-06T12:00:00.000Z",
    "routes": [
      {
        "route": "/docs/intro",
        "prefetched": {
          "visits": 12,
          "buckets": {
            "0-100ms": 4,
            "100-200ms": 6,
            "200-400ms": 2,
            "400-800ms": 0,
            "800-1600ms": 0,
            "1600ms+": 0,
          },
        },
        "nonPrefetched": {
          "visits": 9,
          "buckets": {
            "0-100ms": 1,
            "100-200ms": 3,
            "200-400ms": 3,
            "400-800ms": 2,
            "800-1600ms": 0,
            "1600ms+": 0,
          },
        },
      },
    ],
  }
  ```

- **PII safeguards:** Route paths are truncated to the first four segments, numeric identifiers become `:int`, hexadecimal-like tokens become `:hash`, and anything longer than 48 characters is truncated. Prefetch hints expire from session storage after 15 minutes so multi-user devices cannot correlate visits.
- **Persistence strategy:** Aggregates live in local storage under `apotheon.prefetch.telemetry.v1` for batching and session storage tracks short-lived 'was-prefetched' hints. Controllers call `prefetchTelemetry.submitPending()` only after confirming consent and DNT requirements via `trackAnalyticsEvent`, ensuring the Worker proxy remains the sole egress path.
- **Automation hook:** The Cloudflare Worker at `workers/analytics-proxy.ts` normalizes every payload (route sanitization, bucket clamping, empty-batch suppression) before signing and forwarding the payload downstream. Contract tests cover this flow so CI can assert ≥20 % improvements without risking data quality regressions.

## Contributing

> **Process note:** Conventional Commits, lint-staged auto-fixes, and CI parity are non-negotiable. Each guideline below keeps the platform enterprise-grade.

1. Branch from `main` and keep feature branches short-lived to reduce merge drift.
2. Build UI in `.astro` files with React islands only when interaction is mandatory; this preserves the static-first contract demanded by the hero pledge.
3. Run `npm run test` and `npm run build` before opening a PR so CI remains a confirmation step, not a debugging session.
4. Document changes in `CHANGELOG.md` and the relevant `/docs` section; our investors and compliance teams rely on those artifacts for review cycles.
5. Use the [Quick Start](#quick-start) commands whenever refreshing dependencies—the automation scripts regenerate assets, diagrams, and search indexes automatically.
6. Reconcile proposals with the [ROADMAP](ROADMAP.md) before opening a PR so roadmap, docs, and implementation remain fully aligned.

## License

This project is licensed under the [MIT License](LICENSE). Review the permissive grant alongside internal security guidelines before redistributing derivatives.
