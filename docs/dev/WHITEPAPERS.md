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

1. Launch the Playwright-driven generator (`scripts/content/generate-whitepapers.ts`) which renders
   every MDX entry into a production PDF using a standardized template.
2. Calculate SHA-256 checksums, decode the page count with `pdf-lib`, and stamp both values into the
   frontmatter so Cloudflare Workers can validate signed-url requests deterministically.
3. Refresh `src/generated/whitepapers.manifest.ts`, which powers the request form, Worker validation,
   and analytics surfaces.
4. When Chromium is unavailable, hydrate `assets/whitepapers/managed-assets.json` into the working
   directory. The managed ledger stores base64-encoded production PDFs with recorded checksums,
   provenance notes, and page counts so zero-touch environments can still validate content.

The pipeline writes PDFs to `assets/whitepapers/` during execution, but `.gitignore` blocks the binaries
from landing in commits. Developers should stage the manifest/frontmatter changes only—CI regenerates the
artifacts to validate integrity. If Chromium is unavailable, the ensure script hydrates a placeholder PDF
as a safety net while still preventing placeholder checksums from passing tests. The fallback cascade is
documented directly in `scripts/content/ensure-whitepapers.ts` (generator → managed ledger → placeholder)
so auditors can trace exactly how assets materialize across automation tiers.

The ensure script now checks the managed ledger before ever downgrading to the placeholder PDF. Only when
both Playwright and the ledger are unavailable will the placeholder hydrate. In those cases, the script
intentionally avoids overwriting existing frontmatter metadata so the last known good checksum remains in
source control. New developer environments should run `npx playwright install --with-deps chromium` once
to bootstrap the generator and keep the ledger in "break glass" territory.

> ℹ️ **Ledger stewardship:** Playwright remains the source of truth for production refreshes. Whenever a
> PDF changes, regenerate via Playwright, update the manifest/frontmatter, and then rebuild
> `managed-assets.json` so offline automation paths continue to match production binaries.

Vitest coverage (`scripts/content/__tests__/whitepapers-assets.test.ts`) enforces that every manifest
entry produces a PDF larger than the placeholder baseline, carries a unique checksum, and exposes the
expected page count. Tests also simulate generator outages to confirm the managed ledger hydrate path
produces multi-page PDFs with digests aligned across the ledger, frontmatter, and manifest.

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
- When a visitor arrives with `?whitepaperSlug=<slug>` in the query string (e.g., homepage hero CTA),
  the React island auto-selects the manifest entry, logs `whitepaper_request_prefill_applied`, and
  keeps the value sticky after successful submissions so deep-link journeys remain auditable.
- Successful submissions display the signed URL inline and remind teams to store PDFs in approved
  repositories.

## Investor brief distribution checklist

- The investor journey now includes the **Apotheon.ai Investor Brief**. Run `npm run ensure:whitepapers`
  to render the PDF from MDX, calculate the checksum/page count, and update the manifest so the Worker can
  generate signed URLs. The PDF itself remains untracked—upload the regenerated artifact to R2 post-merge.
- Investor relations owns distribution. Every email or CRM activity must reference the
  `/about/contact/?team=investor-relations` flow to preserve analytics and automation context.
- The homepage hero CTA now points to
  `/about/white-papers/?whitepaperSlug=apotheon-investor-brief#whitepaper-request`; confirm any
  campaign landing pages mirror the query parameter so prefill + analytics events fire consistently.
- Weekly, reconcile the Worker\'s D1 ledger against CRM logs to confirm only allowlisted domains accessed the
  asset. Escalate anomalies to `ir@apotheon.ai` and `revops@apotheon.ai`.
- When updating the PDF, rerun the ensure script, commit the checksum change, and notify marketing so
  nurture sequences reference the refreshed artifact. The `investors.mdx` page surfaces the R2 object key
  for quick audits.

## Reviewer expectations

When reviewing pull requests that touch whitepapers:

1. Confirm `npm run ensure:whitepapers` has been executed (manifest + checksums updated).
2. Validate new MDX entries include clear gating notes and compliance contacts.
3. Inspect Worker changes for continued use of domain analysis, Turnstile verification, signed URLs,
   and D1 logging.
4. Run the required QA commands documented in the PR template (`npm run lint`, `npm run typecheck`,
   `npm run test`, `npm run test:e2e`, `npm run build`, `npm run ladle:build`).
5. For production launches, ensure Wrangler secrets and bindings exist in the target account.
