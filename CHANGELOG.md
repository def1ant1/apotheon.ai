# Changelog

All notable changes to this project are documented here. This log follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions and
semantic versioning once releases begin.

## Unreleased

### Added

- Finalized the Astro 5 migration baseline: upgraded Astro core, adjusted Vite
  plugins, and validated Node.js 20/22 parity against lint, type-check,
  Vitest, Playwright, and build automation.
- Hardened DX guardrails for Astro 5 by documenting Playwright browser
  provisioning, deterministic media fixture generation, and Tailwind Vite
  integration requirements in README and `reports/automation/`.
- Logged the Node.js LTS and Current automation audit in
  `reports/automation/2025-02-15-node-matrix.md` so future releases inherit a
  reproducible verification trail.
- Migrated the web platform to an Astro 4 static-first architecture with React
  islands, Tailwind CSS, MDX content collections, Pagefind search automation, and
  hardened CSP defaults.
- Centralised SEO automation: shared manifest-driven sitemap integration,
  environment-aware robots.txt generation, and Pagefind post-build indexing with
  smoke verification scripts.
- Introduced a Radix-powered navigation menu island with shared Tailwind tokens,
  hydration guidance, and accessibility notes documented across README and
  developer workflows.
- Bundled the Inter variable typeface via `@fontsource-variable/inter`, removed
  Google Fonts dependencies, and documented the self-hosted font workflow across
  README and security runbooks.
- Delivered nonce-based CSP middleware, HTTPS dev tooling, mkcert automation,
  and documentation for capturing CSP reports via Cloudflare Workers.
- Introduced baseline Astro project scaffolding (`src/pages`, `src/layouts`,
  `src/components/islands`, `src/styles`, and content collections).
- Added automation scripts for linting, formatting, building, previewing, and
  Pagefind indexing via npm.
- Captured Cloudflare-centric architecture decisions, security boundaries, and performance budgets in `docs/architecture/DECISIONS.md`.
- Published a system context diagram (`docs/architecture/system-context.puml` + `.svg`) showing browser↔edge↔data plane flows.
- Documented open-source/zero-cost substitutes for each managed service in `docs/infra/ALTERNATIVES.md`.

### Changed

- README now references Astro 5 as the project baseline and links the automation
  audit log alongside remediation guidance for missing dependencies highlighted
  during the migration.
- Canonicalized the finance industry slug at `/industries/finance`, updated navigation, CTA routes, and documentation, and
  regenerated search fixtures to retire the legacy `/industries/financial-services` path.
- Replaced the prior Vite/React SPA entrypoints and removed unused Amplify and
  Vercel scaffolding.
- Expanded developer documentation (`docs/dev/WORKFLOWS.md`, README) with Radix
  integration practices and Tailwind token usage.
- Updated build and CI workflows so `npm run build` now chains Astro, sitemap,
  robots, Pagefind, and verification steps while new docs capture rerun guidance.
- Updated documentation (README and engineering playbook) to reflect the new
  static-first stack and workflows.

### Removed

- Legacy React components, routing, and configuration files incompatible with the
  Astro architecture.
- Static `public/robots.txt` in favor of manifest-driven generation.
