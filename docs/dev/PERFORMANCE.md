# Performance & OpenGraph Automation

This guide captures the automation that keeps our marketing surface fast, visually consistent, and regression friendly. Use it as a runbook when introducing new assets or reviewing pull requests that touch the rendering pipeline. For the Playwright workflow that enforces visual fidelity, see [End-to-end testing & visual baselines](./TESTING.md). Deployment engineers should pair these notes with the [Deployment & Edge Compression Playbook](./DEPLOYMENT.md) to translate build artefacts into CDN cache rules without manual guesswork.

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

## Navigation prefetch automation

### PrefetchManager ↔ PrefetchController contract

- `src/components/islands/PrefetchController.tsx` is the only surface that should instantiate the shared `PrefetchManager`. The island mounts in the global header and footer so speculative navigation becomes ubiquitous without bespoke page wiring.
- The controller only enrols anchors that spread `PREFETCH_ATTRIBUTE_PAYLOAD` (`data-prefetch="intent"`); this explicit opt-in keeps marketing, docs, and authenticated surfaces aligned on which links are safe to hydrate ahead of time.
- Eligible anchors are registered once and tracked through a shared runtime that is reference-counted. When the last island unmounts, the runtime tears down observers, listeners, and telemetry handles automatically to avoid ghost prefetches during onboarding modals or route transitions.
- The MutationObserver watches for attribute changes and dynamically inserted anchors. Consumers can also dispatch the `PREFETCH_REFRESH_EVENT` to force a rescan after Astro Islands render client-side navigations.

#### Eligibility and automation safeguards

- `evaluateAnchorEligibility` guarantees that only same-origin, http(s) navigations without `download` attributes or `_blank` targets can be registered. Custom allow predicates can be layered on by surfaces that want to short-circuit prefetching based on business logic.
- `respectSaveData` and the network `effectiveType` guard rails are enabled by default so low-bandwidth visitors never see speculative traffic. Setting `respectSaveData` to `false` in the manager config requires a compliance review.
- `respectReducedMotion` defaults to `true`; pointer-enter heuristics disable themselves when `prefers-reduced-motion` is active so screen readers and high-sensitivity users do not encounter background network bursts. IntersectionObserver and focus-based triggers remain active because they align with explicit intent.
- Prefetches are scheduled through `requestIdleCallback` (with a timeout fallback) and concurrency-limited to four in-flight requests, ensuring the feature plays nicely with the main thread and connection pools on lower-end devices.

### Telemetry, aggregation, and monitoring

- Every successful speculative fetch invokes `prefetchTelemetry.markPrefetched`, setting a signed sessionStorage flag for the normalised route. When the subsequent navigation timing beacon fires, the telemetry controller joins that flag with the recorded TTFB to determine whether the experience was warm or cold.
- Aggregates are persisted in localStorage under `apotheon.prefetch.telemetry.v1` as capped histograms for each anonymised route. The controller trims to 48 routes per session, caps visit counters at 10,000, and normalises sensitive path segments (e.g., `/customers/:int/orders/:hash`) before egress.
- **Flush requirements:** `prefetchTelemetry.submitPending` is intentionally not auto-invoked. Product surfaces must explicitly call it (typically from the same consent-gated analytics queue that ships commerce beacons) to release batches to the analytics proxy Worker. Without that integration, aggregates remain in localStorage and the downstream dashboards stay empty.
- Dashboards:
  - **Grafana – Prefetch Warmth Coverage** (`https://grafana.apotheon.ai/d/prefetch-nav/perf-prefetch`): Tracks warm vs. cold visit mix, TTFB histogram deltas, and the ratio of speculative hits to misses.
  - **Looker – Prefetch Trend Report** (`https://looker.apotheon.ai/dashboards/prefetch-efficiency`): Surfaces 7/30-day regressions, route families with outlier TTFB buckets, and alert states mirrored into PagerDuty.
- Alerts on those dashboards notify #web-perf-ops when warm coverage dips below 55% for any high-traffic route or when cold TTFB p95 exceeds the Lighthouse guardrail. Operators should expect a single consolidated batch event per active session; duplicate bursts typically indicate client-side storage resets or analytics proxy replays.

### Troubleshooting runbook

- **Anchors ignored** – Confirm the link spreads `PREFETCH_ATTRIBUTE_PAYLOAD` and does not include `download`, `_blank`, or cross-origin URLs. The `tests/e2e/navigation-prefetch.spec.ts` fixture page offers parity examples for quick regression checks.
- **Prefetches never fire** – Inspect DevTools > Application > Storage to verify reduced-motion and Save-Data signals. Forcing those preferences locally should suppress pointer and idle triggers; if they do not, assert that `respectReducedMotion`/`respectSaveData` were not overridden.
- **Telemetry gaps** – Inspect localStorage/sessionStorage for the `apotheon.prefetch.*` keys. Missing entries usually mean prefetches never fired; if data is present but dashboards are blank, confirm an owning surface is calling `prefetchTelemetry.submitPending` after analytics consent. When submissions do occur, tail the analytics proxy Worker logs (Cloudflare dashboard → Analytics Proxy → Recent logs) for schema validation errors or rate limit denials.
- **Dashboard regression** – Review the most recent deploy for changes to `prefetch-manager.ts` or link templates. If the Worker is returning 428 errors, Cloudflare may not be appending geo headers due to a configuration drift—check the zone worker routes first.

## Lighthouse calibration

Run `npm run lighthouse:calibrate` to generate fresh JSON audits under `reports/lighthouse/`. The script:

1. Locates a Chromium binary (preferring the bundled Puppeteer build when Chrome is unavailable).
2. Executes `lhci autorun` with our production budgets (`lighthouserc.json`).
3. Copies each Lighthouse report into `reports/lighthouse/` and writes a `calibration-manifest.json` with the URL, fetch time, performance score, and LCP metric.

`npm run lighthouse:ci` now runs both the desktop and mobile profiles defined in `lighthouserc.json`. Desktop results must continue to satisfy a ≥0.90 performance score with ≤2.5 s LCP/TBT ≤150 ms, while the mobile sweep simulates 4G radio conditions and enforces ≥0.85 performance with ≤3.2 s LCP/TBT ≤200 ms. Each suite uploads into `artifacts/lighthouse/<profile>/` so PR reviewers can compare reports side-by-side. Calibration simply keeps a local archive for diffing trends.

## Reviewer checklist

- [ ] Verify `src/generated/og-assets.manifest.json` updates correspond to intentional Worker renders (stale signatures or unexpected endpoints usually indicate env misconfiguration).
- [ ] Confirm `src/generated/image-optimization.manifest.json` entries were regenerated (new hashes/derivatives) when imagery changes.
- [ ] Ensure new pages or routes update `lighthouserc.json` if they should fall under the performance budget umbrella.
- [ ] Review both `artifacts/lighthouse/desktop` and `artifacts/lighthouse/mobile` outputs when performance regressions are suspected; the latter represents our 4G mobile budget.
- [ ] Run `npm run lighthouse:calibrate` after large visual overhauls and commit updated reports if the baseline changes.
- [ ] Refresh Playwright theme fixtures via `npm run test:e2e:update-theme-visual` (documented in [TESTING.md](./TESTING.md)) when UI adjustments are intentional so CI inherits deterministic screenshots.

## CI validation for navigation prefetch

- **Unit coverage** – `vitest` executes `src/utils/__tests__/prefetch-manager.test.ts` and `src/utils/navigation/__tests__/prefetch-telemetry.test.ts`, hardening the eligibility decision tree, reduced-motion enforcement, TTL expiries, anonymisation helpers, and analytics submission contract.
- **Playwright suite** – `tests/e2e/navigation-prefetch.spec.ts` visits the `/testing/navigation-prefetch` fixture and asserts pointer, intersection, and automation safeguards. The spec references the same attribute payloads outlined above, so regressions immediately highlight contract drift.
- **Lighthouse budgets** – `npm run lighthouse:ci` monitors the TTFB and LCP deltas caused by speculative navigation. Prefetch regressions typically manifest as slower mobile LCP; the calibration workflow keeps the baseline aligned with the dashboards referenced in the telemetry section.
- **New specification docs** – Any change to the contract or telemetry flow must update this file and the Playwright fixture markup so CI and documentation remain in sync.

## Rollback guidance

- To revert OpenGraph automation, delete or revert the manifest entry for the affected slug and redeploy. The static build will fall back to the curated asset path when the Worker or signing key is unavailable.
- To roll back image derivatives, restore the previous `src/assets/**` SVGs (or hero PNG) and the corresponding manifest entry. The ensure scripts regenerate AVIF/WebP derivatives under `public/generated/**` on the next pipeline run and clean up leftovers automatically.
- If Lighthouse budgets tighten unexpectedly, revert `lighthouserc.json` and re-run calibration. Budgets are enforced in CI, so a revert will unblock builds immediately.
