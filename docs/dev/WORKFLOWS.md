# Contact submission workflow

The `/about/contact/` experience now routes through a Cloudflare Worker so every
inquiry lands in auditable infrastructure backed by D1. This document outlines
how the pipeline is wired together and what automation keeps it healthy in
pre-production environments.

## High-level sequence

1. **Client-side validation** happens in the `ContactForm` React island. Inputs
   leverage the shared `contactFormSchema` and domain analysis utilities to
   mirror the Worker logic, immediately coaching the user toward corporate
   email addresses and complete narratives.
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
- GitHub Actions (`.github/workflows/ci.yml`) includes a `deploy-workers`
  job that executes on pushes to `main`. It uses `cloudflare/wrangler-action` so
  both the CSP report endpoint and the contact intake Worker ship together.
- CI still runs the standard quality gates (`npm run lint`, `npm run typecheck`,
  `npm run test`, `npm run test:e2e`, `npm run build`). The Playwright scenario
  ensures the UI reacts correctly to acceptance/rejection responses.

## Environment configuration

- Set `PUBLIC_CONTACT_ENDPOINT` and `PUBLIC_TURNSTILE_SITE_KEY` in build-time
  environments so the island hydrates with the correct endpoints.
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
