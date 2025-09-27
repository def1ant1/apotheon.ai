# Apotheon.ai Web Platform

<div align="center">

<strong>Secure, Static-First Enterprise Hub for AI Documentation &amp; Marketing</strong>

[![Astro Static Platform](https://img.shields.io/badge/Astro-Static%20Sites-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Tailwind Utility System](https://img.shields.io/badge/Tailwind-Design%20Tokens-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GitHub Repo stars](https://img.shields.io/github/stars/apotheon-ai/apotheon.ai?style=social)](https://github.com/apotheon-ai/apotheon.ai/stargazers)

<em>Zero-trust posture, automation-first operations, and obsessive documentation keep this marketing + documentation hub pre-production ready.</em>

</div>

> **Enterprise note:** Everything in this repository assumes regulated-industry baselines—explicit automation, immutable audit trails, and static-first delivery to minimize operational variance.

## Quick Start

> **Onboarding tip:** These commands intentionally mirror the CI pipeline so that every workstation matches production expectations. Stick to the sequence; each step caches work for the next one.

### 1. Provision the toolchain (one-time per workstation)

- Install **Node.js ≥ 18 LTS** and **npm ≥ 9**. Pin versions via `asdf`, `nvm`, or your preferred fleet manager so upgrades stay coordinated across teams.
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
```

> **Automation note:** `npm run test` orchestrates the full stack (lint → typecheck → unit → Ladle CI → SEO monitor → synthetic worker tests). Use it before every PR to avoid rework.

### 4. Build and inspect production artifacts

```bash
npm run build            # Static render + sitemap + hreflang + robots + Pagefind index + SEO verification
npm run preview          # Serves the production bundle with asset headers and CSP enforced
```

> **Performance note:** The build command chains through diagrams, OG images, and recommendation models so nothing ships stale. Keep the step intact for deterministic releases.

### 5. Deploy on fully managed edges

- **Cloudflare Pages (recommended):** Connect the repo, set `NODE_VERSION=18` and `NPM_FLAGS=--legacy-peer-deps` if corporate proxies interfere, then let Pages run `npm run build` automatically.
- **Netlify / Vercel / S3 + CloudFront:** Point the build command to `npm run build` and publish the generated `dist/` directory. Preserve the generated headers from `astro.config.mjs` for CSP correctness.
- **Workers assets:** Execute `npm run workers:deploy` after Pages completes; the script auto-discovers worker environments and syncs secrets via Wrangler.

> **Reliability note:** Backups run through `npm run ops:backup:dry-run` to validate D1 + R2 exports before production rollouts.

## Features

- **Static-first Astro foundation** — Every marketing and documentation page pre-renders, then hydrates React islands only where necessary for accessibility-critical interactions.
- **Tailwind + Radix design system** — Centralized tokens in `tailwind.config.mjs` and Radix wrappers (see `src/components/islands/`) unlock enterprise theming without bespoke utility drift.
- **Search + personalization automation** — `npm run build` regenerates Pagefind indexes and blog recommendation models, ensuring investors and analysts land on fresh, relevant content with zero manual steps.
- **Security-first workflows** — mkcert-driven HTTPS, CSP enforcement, Workers rate limiting, and Vale-driven content linting all run by default to satisfy regulated-industry audits.
- **Extensive runbooks** — Architecture decisions, incident response guides, and brand governance live under `/docs` with direct callouts from the README so new hires never chase tribal knowledge.

> **Where to dive deeper:** Start with the [Architecture Decision Ledger](docs/architecture/DECISIONS.md), inspect the [system context diagram](docs/architecture/system-context.svg), then review the [brand style guide](docs/brand/STYLEGUIDE.md) before editing UI.

## Contributing

> **Process note:** Conventional Commits, lint-staged auto-fixes, and CI parity are non-negotiable. Each guideline below keeps the platform enterprise-grade.

1. Branch from `main` and keep feature branches short-lived to reduce merge drift.
2. Build UI in `.astro` files with React islands only when interaction is mandatory; this preserves the static-first contract demanded by the hero pledge.
3. Run `npm run test` and `npm run build` before opening a PR so CI remains a confirmation step, not a debugging session.
4. Document changes in `CHANGELOG.md` and the relevant `/docs` section; our investors and compliance teams rely on those artifacts for review cycles.
5. Use the [Quick Start](#quick-start) commands whenever refreshing dependencies—the automation scripts regenerate assets, diagrams, and search indexes automatically.

## License

This project is licensed under the [MIT License](LICENSE). Review the permissive grant alongside internal security guidelines before redistributing derivatives.
