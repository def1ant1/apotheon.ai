# Changelog

All notable changes to this project are documented here. This log follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions and
semantic versioning once releases begin.

## Unreleased

### Added
- Migrated the web platform to an Astro 4 static-first architecture with React
  islands, Tailwind CSS, MDX content collections, Pagefind search automation, and
  hardened CSP defaults.
- Introduced baseline Astro project scaffolding (`src/pages`, `src/layouts`,
  `src/components/islands`, `src/styles`, and content collections).
- Added automation scripts for linting, formatting, building, previewing, and
  Pagefind indexing via npm.

### Changed
- Replaced the prior Vite/React SPA entrypoints and removed unused Amplify and
  Vercel scaffolding.
- Updated documentation (README and engineering playbook) to reflect the new
  static-first stack and workflows.

### Removed
- Legacy React components, routing, and configuration files incompatible with the
  Astro architecture.
