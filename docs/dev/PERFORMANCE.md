# Performance & OpenGraph Automation

This guide captures the automation that keeps our marketing surface fast, visually consistent, and regression friendly. Use it as a runbook when introducing new assets or reviewing pull requests that touch the rendering pipeline.

## OpenGraph image workflow

1. The `workers/og-images.ts` Cloudflare Worker renders OpenGraph art with Satori + ResVG. Requests must include a signed HMAC query (`signature` + `expires`).
2. The Worker validates signatures, looks for warmed responses in KV (`OG_IMAGE_CACHE`), and streams a PNG. The resulting render metadata is persisted in the `og_assets` D1 table for compliance/auditing.
3. `src/utils/og.ts` exposes `ensureOgAsset`. Build-time code calls this helper with the blog slug/title. When the Worker returns successfully, `src/generated/og-assets.manifest.json` is updated with the canonical, signed URL.
4. `resolveOgImage` uses the manifest on subsequent builds. If the entry has expired or the Worker endpoint changed, the helper re-generates and refreshes the manifest automatically.

### Caching strategy

- **Edge cache** – The Worker writes successful renders into `caches.default` with a 30-day TTL. Social crawlers typically cache URLs even longer, so signatures default to 45 days in `ensureOgAsset`.
- **KV** – Rendered PNGs are stored under `OG_IMAGE_CACHE` for seven days. KV misses trigger a re-render but the HTTP layer still honors previously signed URLs until they expire.
- **D1** – `og_assets` captures scope, slug, variant, checksum, and expiry. This table doubles as an audit log and a convenient source for BI dashboards.

> **Rollback tip:** remove the affected manifest entry (`src/generated/og-assets.manifest.json`) and re-run `npm run ensure:og-assets` to reset stale URLs. The Worker will regenerate assets on the next build.

## Image optimization pipeline

- `scripts/content/ensure-history-media.ts` validates every history SVG, generates AVIF/WebP derivatives via Sharp, updates provenance manifests, and records metadata in `src/generated/image-optimization.manifest.json`. Derivatives land under `public/generated/history/` so reviewers never have to approve binary diffs; the script prunes stale files automatically.
- `scripts/content/ensure-homepage-hero-media.ts` guarantees the hero base image exists, produces AVIF/WebP derivatives, and marks the hero as both `preload: true` and `lcpCandidate: true` in the shared manifest.
- `astro.config.mjs` reads the manifest at config time, injecting a global constant so layouts and components can surface preload/LCP annotations without hard-coding file paths.
- `HomepageHero.astro` consults the manifest to decide whether to emit the AVIF preload (falling back to the existing frontmatter flag) and tags the media wrapper with `data-lcp-candidate` for perf tooling.

## Lighthouse calibration

Run `npm run lighthouse:calibrate` to generate fresh JSON audits under `reports/lighthouse/`. The script:

1. Locates a Chromium binary (preferring the bundled Puppeteer build when Chrome is unavailable).
2. Executes `lhci autorun` with our production budgets (`lighthouserc.json`).
3. Copies each Lighthouse report into `reports/lighthouse/` and writes a `calibration-manifest.json` with the URL, fetch time, performance score, and LCP metric.

The CI workflow continues to run `npm run lighthouse:ci`, which uploads reports to `artifacts/lighthouse` for every PR. Calibration simply keeps a local archive for diffing trends.

## Reviewer checklist

- [ ] Verify `src/generated/og-assets.manifest.json` updates correspond to intentional Worker renders (stale signatures or unexpected endpoints usually indicate env misconfiguration).
- [ ] Confirm `src/generated/image-optimization.manifest.json` entries were regenerated (new hashes/derivatives) when imagery changes.
- [ ] Ensure new pages or routes update `lighthouserc.json` if they should fall under the performance budget umbrella.
- [ ] Run `npm run lighthouse:calibrate` after large visual overhauls and commit updated reports if the baseline changes.

## Rollback guidance

- To revert OpenGraph automation, delete or revert the manifest entry for the affected slug and redeploy. The static build will fall back to the curated asset path when the Worker or signing key is unavailable.
- To roll back image derivatives, restore the previous `src/assets/**` SVGs (or hero PNG) and the corresponding manifest entry. The ensure scripts regenerate AVIF/WebP derivatives under `public/generated/**` on the next pipeline run and clean up leftovers automatically.
- If Lighthouse budgets tighten unexpectedly, revert `lighthouserc.json` and re-run calibration. Budgets are enforced in CI, so a revert will unblock builds immediately.
