# Apotheon.ai Delivery Roadmap

> **Operating principle:** Ship static-first, automation-enforced increments that keep the marketing and documentation hub pre-production ready at all times. Every line item below traces back to a scriptable workflow so manual effort never becomes a dependency.

## Shipped Releases

### v1.0 — Static-First Investor Hub (Shipped)

- ✅ Astro foundation with Tailwind + Radix design system, pagefind search, and workers hardening deployed to Cloudflare Pages.
- ✅ Content automation covers hero media, OG assets, and whitepaper stubs to avoid asset drift between releases.
- 🔁 Observability, SEO, and security checks wired into the default CI lint job so teams inherit enterprise baselines.
- **Automation notes:**
  - [scripts/content/ensure-homepage-hero-media.ts](scripts/content/ensure-homepage-hero-media.ts) backfills hero imagery before every build.
  - [scripts/content/ensure-og-assets.ts](scripts/content/ensure-og-assets.ts) guarantees OG/Twitter cards stay in sync with Markdown copy.
  - [scripts/security/mkcert-localhost.sh](scripts/security/mkcert-localhost.sh) supplies local TLS to rehearse CSP policies before shipping.

## Near-Term Milestones

### v1.1 — Multi-language Support & Localization Ops (Next)

- Expand Astro i18next configuration to deliver localized navigation, metadata, and CTA flows while preserving static prerendering.
- Establish translation memory and glossary governance to keep messaging consistent across regulated industries.
- Integrate Vale localization styles to block untranslated content from merging.
- **Automation notes:**
  - [astro-i18next.config.mjs](astro-i18next.config.mjs) stores locale routing, fallback, and namespace conventions.
  - [scripts/content/run-vale.mjs](scripts/content/run-vale.mjs) executes Vale with localization-aware styles in CI and pre-commit.
  - [scripts/content/ensure-cms-config.mjs](scripts/content/ensure-cms-config.mjs) seeds multilingual CMS scaffolding so editors get deterministic frontmatter requirements.

### v1.2 — Personalization & Recommendation Enhancements

- Extend the static Pagefind index with investor personas and integrate recommendation data into hero modules without runtime penalties.
- Wire investor/industry taxonomy to workers for gated download personalization and investor brief prioritization.
- Harden metrics to confirm improved engagement via synthetic monitoring and Lighthouse budgets.
- **Automation notes:**
  - [scripts/content/build-blog-recommendations.mjs](scripts/content/build-blog-recommendations.mjs) regenerates recommendation vectors during `npm run build`.
  - [scripts/search](scripts/search) utilities normalize Pagefind indexing for new taxonomies.
  - [scripts/tests](scripts/tests) suites keep Playwright/Ladle smoke coverage current as personalization variants increase.

### v1.3 — Compliance-Grade Lead Handling

- Deploy the Cloudflare Worker contact pipeline with KV-backed rate limiting, Turnstile validation, and D1 audit storage.
- Provide investor dashboards summarizing signed download activity and compliance attestations.
- Fold incident response hooks into ops runbooks with automated dry runs.
- **Automation notes:**
  - [workers/contact](workers/contact) Worker handlers encapsulate validation, storage, and webhook emission.
  - [scripts/ops](scripts/ops) contains backup and verification routines, including `ops:backup:dry-run` for D1/R2 exports.
  - [scripts/security](scripts/security) provides abuse detection and secret rotation helpers used by the worker deployment flow.

## Longer-Term Initiatives

### AI-Augmented Content Governance

- Author review bots that enrich Markdown with compliance footnotes and investor risk scoring before publication.
- Surface tone, reading level, and compliance gaps inside PR comments to keep content audit-ready.
- **Automation notes:** Integrate with [scripts/content/shared](scripts/content/shared) utilities to lint Markdown frontmatter and queue Vale profiles per persona.

### Global Platform Observability

- Expand synthetic monitoring to cover SLA/SLO dashboards, RUM ingestion, and Lighthouse regression tests per locale.
- Automate on-call previews with screenshot diffs and accessibility traces appended to every release.
- **Automation notes:** [scripts/perf](scripts/perf) and [scripts/seo](scripts/seo) directories host lighthouse, CWV, and schema validators ready for CI orchestration.

### Enterprise Knowledge Delivery

- Publish API documentation and knowledge base updates through a single MDX pipeline synced with worker APIs and signed assets.
- Offer investors auto-generated briefings that aggregate blog, whitepaper, and product insights from the same static bundle.
- **Automation notes:** [scripts/content/generate-whitepapers.ts](scripts/content/generate-whitepapers.ts) and [scripts/content/ensure-whitepapers.ts](scripts/content/ensure-whitepapers.ts) keep gated assets synchronized with marketing pages.

> **Keep shipping:** Re-run `npm run lint` + `npm run build` before every release to exercise the full automation lattice. Anything that cannot be scripted gets logged as technical debt in `docs/workplan/EPICS_AND_WORK_ITEMS.md`.
