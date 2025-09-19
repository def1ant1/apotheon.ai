# Changelog

All notable changes to this project are documented here. This log follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions and
semantic versioning once releases begin.

## Unreleased

### Added

- Migrated the web platform to an Astro 4 static-first architecture with React
  islands, Tailwind CSS, MDX content collections, Pagefind search automation, and
  hardened CSP defaults.
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

- Replaced the prior Vite/React SPA entrypoints and removed unused Amplify and
  Vercel scaffolding.
- Expanded developer documentation (`docs/dev/WORKFLOWS.md`, README) with Radix
  integration practices and Tailwind token usage.
- Updated documentation (README and engineering playbook) to reflect the new
  static-first stack and workflows.

### Removed

- Legacy React components, routing, and configuration files incompatible with the
  Astro architecture.
