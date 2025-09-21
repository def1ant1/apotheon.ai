# Whitepaper delivery pipeline

Enterprise whitepapers run through a fully automated pipeline so regulated teams can trust every
download and reviewer can audit the trail end-to-end.

## Content authoring

- Author files under `src/content/whitepapers/`. The schema enforces:
  - Title, summary, and target industries.
  - `asset` metadata (R2 object key, checksum, page count, MIME type).
  - `gatingNotes` documenting distribution guidance, reviewer checklists, and compliance contacts.
  - `lifecycle` flags for draft/archived states and optional embargo dates.
- Embed editorial comments directly in the MDX body to remind marketing of compliance guardrails.

## Asset hygiene automation

Run `npm run ensure:whitepapers` (automatically triggered in `predev`, `prebuild`, and CI) to:

1. Generate placeholder PDFs for new entries so designers are never blocked by missing assets.
2. Calculate SHA-256 checksums and stamp them into frontmatter.
3. Refresh `src/generated/whitepapers.manifest.ts`, which powers the request form, Worker validation,
   and analytics surfaces.

Replace placeholders in `assets/whitepapers/` with production-ready PDFs, rerun the script, and commit
the updated checksums.

## Worker architecture

The `workers/whitepapers.ts` entry point handles `/api/whitepapers` requests. It:

- Reuses the shared domain analysis utilities to classify email domains and optionally perform MX
  lookups for review flows.
- Verifies Turnstile tokens, enforces KV-backed rate limits, and filters requests against optional
  allow/block lists defined in Wrangler vars.
- Issues time-bound signed URLs from the `WHITEPAPER_ASSETS` R2 bucket and records the expiry.
- Persists every request to the `whitepaper_requests` D1 table (see
  `workers/migrations/whitepapers/0001_init.sql`) with domain rationale, Turnstile telemetry, MX
  records, and marketing opt-in state.

## Deployment configuration

`wrangler.toml` ships an isolated `whitepaper_delivery` environment:

- `WHITEPAPER_RATE_LIMIT` KV namespace for throttling.
- `WHITEPAPER_AUDIT_DB` D1 binding for the audit ledger.
- `WHITEPAPER_ASSETS` R2 bucket storing PDFs and generating signed URLs.
- Vars for optional allow/block lists and the signed URL TTL (`WHITEPAPER_SIGNING_TTL_SECONDS`).
- Route `apotheon.ai/api/whitepapers` for production delivery.

Secrets to configure via `wrangler secret put`:

- `TURNSTILE_SECRET` — server-side key for verifying challenges.
- Any additional integration secrets (e.g., webhook URLs) should be added as Wrangler secrets and
  documented here when introduced.

## Marketing experience

- `/about/white-papers/` renders the catalog copy and hydrates `WhitepaperRequestForm`, which pushes
  structured events into `window.dataLayer` (`whitepaper_request_*` series) for analytics.
- The form filters available assets using the generated manifest so embargoed or archived entries
  never surface to prospects.
- Successful submissions display the signed URL inline and remind teams to store PDFs in approved
  repositories.

## Reviewer expectations

When reviewing pull requests that touch whitepapers:

1. Confirm `npm run ensure:whitepapers` has been executed (manifest + checksums updated).
2. Validate new MDX entries include clear gating notes and compliance contacts.
3. Inspect Worker changes for continued use of domain analysis, Turnstile verification, signed URLs,
   and D1 logging.
4. Run the required QA commands documented in the PR template (`npm run lint`, `npm run typecheck`,
   `npm run test`, `npm run test:e2e`, `npm run build`, `npm run ladle:build`).
5. For production launches, ensure Wrangler secrets and bindings exist in the target account.
