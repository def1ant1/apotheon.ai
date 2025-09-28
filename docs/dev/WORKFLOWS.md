# Contact submission workflow

The `/about/contact/` experience now routes through a Cloudflare Worker so every
inquiry lands in auditable infrastructure backed by D1. This document outlines
how the pipeline is wired together and what automation keeps it healthy in
pre-production environments.

> **Onboarding reminder:** Before diving into workflow specifics, review the [README Quick Start](../../README.md#quick-start) for the required tooling cadence and the [README Features](../../README.md#features) recap so your local environment mirrors the static-first contract described in the hero block.

## High-level sequence

1. **Client-side validation** happens in the `ContactForm` React island. Inputs
   leverage the shared `contactFormSchema` and domain analysis utilities to
   mirror the Worker logic, immediately coaching the user toward corporate
   email addresses and complete narratives. Query parameters such as
   `team=investor-relations` preselect the appropriate intent while
   `role=dev|security|exec` loads curated copy blocks + CTAs—the resolver keeps
   analytics, RevOps routing, and documentation callouts perfectly in sync.
2. **Turnstile verification** executes client-side; the generated token is sent
   with the submission. A noscript fallback guides users who cannot run the
   widget to escalate through `security@apotheon.ai`.
3. **Cloudflare Worker ingestion** (`workers/contact.ts`) performs rate limiting
   via KV, re-runs Zod validation, verifies the Turnstile token, checks the
   domain against curated block/allow lists, optionally performs MX lookup via
   DNS-over-HTTPS, and persists the record into the D1 `contact_submissions`
   table created by `workers/migrations/contact/0001_init.sql`.
4. **Structured auditing** records the IP, user agent, domain rationale, MX
   results, and Turnstile telemetry so RevOps and Security can monitor
   automation signals over time.

## Automation + deployments

- `wrangler.toml` defines both the legacy CSP Worker and the new contact intake
  Worker. Replace the placeholder account, KV namespace, and D1 identifiers with
  production values. Secrets such as `TURNSTILE_SECRET` are stored via
  `wrangler secret put`.
- `npm run workers:deploy` now inspects the Wrangler config, deploys the default
  CSP Worker, and then deploys each `[env.<name>]` Worker (for contact this is
  `env.contact_intake`). Adding new Workers only requires updating the config;
  the script automatically discovers additional environments.
- `env.lead_viewer` in `wrangler.toml` provisions the read-only lead viewer. It
  reuses the existing contact and whitepaper D1 databases, binds a dedicated
  audit log database, and enforces Basic Auth/IP allow lists via environment
  variables.
- GitHub Actions (`.github/workflows/ci.yml`) includes a `deploy-workers`
  job that executes on pushes to `main`. It uses `cloudflare/wrangler-action` so
  both the CSP report endpoint and the contact intake Worker ship together.
- CI still runs the standard quality gates (`npm run lint`, `npm run typecheck`,
  `npm run test`, `npm run test:e2e`, `npm run build`). The Playwright scenario
  ensures the UI reacts correctly to acceptance/rejection responses.
- `npm run lint` now invokes Vale (via `scripts/content/run-vale.mjs`) so content
  style guardrails run alongside ESLint/Stylelint before merges. The bootstrap
  script auto-detects your host platform/architecture, streams the matching
  release from GitHub, and caches the binary per platform under
  `.cache/vale/<platform>-<arch>/`. Switching between Linux workstations,
  macOS laptops, or Windows VMs no longer requires manual cleanup—each
  environment hydrates its own Vale executable automatically.

### Node.js engine baseline

The [README Quick Start](../../README.md#quick-start) is the canonical source
for runtime support. Align with its **Node.js 20.x/22.x LTS** requirement so the
Worker automation, Astro pipeline, and analytics proxies execute against the
same JavaScript engine everywhere.

- **Pin the runtime locally.** Use `asdf` (`asdf plugin add nodejs && asdf
install nodejs 20.11.1` or the matching 22.x build) or `nvm` (`nvm install
20 --lts=hydrogen && nvm alias default 20`) to enforce the LTS pair on every
  workstation. Enterprise device profiles should mirror the same pin so
  onboarding relies on automation, not manual installers.
- **Surface the pin in automation.** GitHub Actions currently executes the full
  workflow on Node 20.x, with a trailing 18.x check temporarily preserved for
  dependency transition audits. Update workflow matrices in step with the
  README whenever the fleet promotes to Node 22.x so CI remains the enforcement
  gate.
- **Propagate the constraint to deployments.** Managed edges (Cloudflare Pages,
  Workers, or containerized previews) must set `NODE_VERSION` to `20` (or `22`
  once validated) to keep generated assets (Pagefind, OG manifests, Workers) in
  lockstep with local builds.

### Pagefind re-index cadence for docs changes

- `npm run search:index` rehydrates the Pagefind bundle under `dist/pagefind/`.
  Run it whenever Markdown/MDX in `docs/` or `src/content/docs/` changes outside
  of a full `npm run build` so local previews mirror production search results.
- The command automatically reuses the prior binary download and canonicalises
  URLs via `scripts/search/postbuild.mjs`; no manual flag toggles or directory
  cleanup are required between runs.
- After reviewing docs updates, run `npm run build` to exercise the same
  pipeline CI will execute. The static build regenerates the sitemap, robots
  directives, and Pagefind index in a single pass to avoid drift.
- Commit the regenerated `public/pagefind/` assets if you run the indexer in a
  production-bound branch so the CDN can ship the refreshed manifest alongside
  the Astro output.

## Internationalization

Global content management follows the same enterprise-ready posture as the
contact intake workflow. The internationalization (i18n) practice leads the
globalisation backlog and is accountable for automation health:

- **Product Marketing (PMM) Ops** owns the language roadmap and approves new
  locales.
- **Developer Experience (DX) Platform** maintains the `astro-i18next`
  configuration and integrates new automation.
- **Quality Engineering (QE)** validates locale rollouts through the feature flag
  strategy described in `docs/dev/I18N.md`.

### JSON key conventions

- Keys reside in `src/i18n/<locale>/*.json` using lower-case, kebab-cased
  namespaces (for example `common.json`, `navigation.json`).
- Nested keys should mirror the component tree (`hero.title`, `hero.cta.label`)
  so cross-locale diffs remain stable.
- Add inline comments to PR descriptions rather than JSON files to keep bundles
  minification-friendly.

### Adding locales and resources

1. Duplicate `src/i18n/en` into a new `src/i18n/<locale>` folder and translate
   each JSON file.
2. Register the locale in `SUPPORTED_LOCALES` inside
   `src/i18n/i18next.server.mjs` and expose the language metadata through any
   marketing components that render locale pickers.
3. Update `astro-i18next.config.mjs` if additional namespaces or fallback
   behavior is required.
4. Ensure QA previews the locale using the `PUBLIC_ENABLE_LOCALE_QA_SWITCHER`
   feature flag described in `docs/dev/I18N.md`. The toggle gates locale routing
   to staging-only environments until the rollout is approved.

### Automation expectations

- Vale runs as part of `npm run lint`, keeping translation Markdown and release
  notes aligned with editorial standards.
- `npm run typecheck`, `npm run test`, and `npm run test:e2e` run in CI and must
  succeed before QA enables the locale flag. Localization helpers, feature flag
  resolvers, and Playwright smoke tests catch regressions automatically.
- Pull requests that touch translation files are blocked by CI linting, Vale,
  and unit/e2e suites; treat red pipelines as release blockers.

### Localization checklists

**Updating translations**

- [ ] Pull the latest language kit from the localisation vendor.
- [ ] Update `src/i18n/<locale>/*.json` files and rerun `npm run lint` to trigger
      Vale and JSON schema validation.
- [ ] Confirm Pagefind manifests index the new locale by running
      `npm run search:index` locally.

**Pre-submission regression checks**

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:e2e`
- [ ] `npm run search:index`
- [ ] Commit regenerated Pagefind assets in `public/pagefind/`.

## Environment configuration

- Set `PUBLIC_CONTACT_ENDPOINT` and `PUBLIC_TURNSTILE_SITE_KEY` in build-time
  environments so the island hydrates with the correct endpoints.
- When shipping new teams/intents, update the intent preset map in
  `ContactForm.tsx`. Add unit tests mirroring `ContactFormIntent.test.ts` to lock
  in routing logic and analytics mappings.
- Configure the following Wrangler bindings before shipping to production:
  - `CONTACT_RATE_LIMIT`: KV namespace for per-domain/IP throttling.
  - `CONTACT_AUDIT_DB`: D1 database seeded via the provided migration.
  - `TURNSTILE_SECRET`: Worker secret used during token verification.
  - Optional `CONTACT_BLOCKLIST` / `CONTACT_ALLOWLIST` CSVs for supplemental
    runtime overrides without code changes.

## Local testing checklist

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test` (includes Vitest coverage for the domain + validation helpers)
4. `npm run test:e2e`
5. `npm run build`

Running the commands locally mirrors the CI gates and ensures the contact
workflow remains enterprise-ready.

## Lead viewer workflow

- The `/lead-viewer/` Astro route hydrates a React admin shell that fetches from
  `workers/lead-viewer.ts`. Credentials are hashed with SHA-256 and supplied via
  `LEAD_VIEWER_BASIC_AUTH_USERS`; IP and origin allow lists live in the
  corresponding environment variables.
- Contract coverage (`workers/__tests__/lead-viewer.contract.test.ts`) exercises
  pagination, allow lists, and audit logging with Miniflare and in-memory D1
  databases.
- Playwright smoke tests (`tests/e2e/lead-viewer-accessibility.spec.ts`) stub the
  Worker API to validate keyboard auth flows, accessible tables, and the CSV
  export affordances rendered in the dashboard.
