# Deployment & Edge Compression Playbook

This playbook equips release managers with the exact steps required to translate our
post-build compression manifest into Cloudflare (or equivalent CDN) rules. The
manifest is the single source of truth for which static artefacts ship with Brotli
and gzip variants, the digests we use for cache-busting, and the metadata the CDN
needs in order to serve the optimal encoding automatically. Lean on the manifest so
you never have to craft bespoke caching policies by hand—the pipeline already
produces the data in a deterministic, audit-friendly shape.

## Compression manifest anatomy

`npm run build` finishes by executing [`scripts/build/postbuild-compress.mjs`](../../scripts/build/postbuild-compress.mjs).
The worker pool emits `.br` and `.gz` companions for every static asset that matches
the [`STATIC_EDGE_COMPRESSION_PATTERN`](../../config/build/compression.mjs) and then
writes `dist/.compressed-manifest.json`. Each entry includes:

- `source` – origin-relative path (e.g., `assets/index.abc123.js`).
- `hash` – SHA-256 digest of the original, uncompressed asset. When filenames change
  or the hash drifts, edge caches can be invalidated surgically.
- `brotli` / `gzip` – size and modification timestamps for each compressed variant.
- `validatedAt` – ISO-8601 timestamp of the compression pass, guaranteeing the
  manifest was produced from the current `dist/` output.

The manifest is authoritative: downstream automation, end-to-end tests, and the CDN
configuration should never guess at which files are compressible or which encodings
exist.

## Edge configuration workflow

1. **Ingest the manifest.** Upload `dist/.compressed-manifest.json` into your CDN's
   KV store or configuration API. The manifest is tiny (<100 KB) even for large
   sites and can be fetched during deployment without affecting cold-starts.
2. **Populate routing metadata.** For each `source` entry, configure the CDN to look
   up the Brotli or gzip variant according to the `Accept-Encoding` header. At
   Cloudflare, this means creating an Edge Worker or Ruleset transform that:
   - Prefers `.br` when the client advertises `br`.
   - Falls back to `.gz` when Brotli is unsupported but gzip appears in
     `Accept-Encoding`.
   - Serves the original asset when neither encoding is present.
3. **Emit the right response headers.** Every compressed response must include
   `Content-Encoding` (`br` or `gzip`), `Content-Length` (matching the compressed
   payload), and `Vary: Accept-Encoding`. The `Vary` header ensures shared caches
   (both our CDN and intermediary proxies) keep separate variants per encoding.
4. **Set Cache-Control consistently.** Hashed filenames allow aggressive caching.
   We recommend `Cache-Control: public, max-age=31536000, immutable` at the CDN edge
   and a matching Time To Live (TTL) of 30 days at the edge tier. If regional tiers
   need shorter windows, do not drop below seven days—hash rotation already provides
   safe cache-busting.
5. **Warm critical assets.** Use the manifest hashes to pre-warm CDN caches for
   hero bundles (LCP candidates, critical CSS) immediately after deployment. Workers
   can iterate through the manifest to trigger background fetches so end users hit
   warmed caches on the first request.

### Brotli primary path

- Cloudflare Rulesets can check `cf.clientAcceptEncoding` for `br`. When true,
  rewrite the origin request to `/<source>.br` and set `Origin-Response:Content-Encoding`
  to `br`.
- Mirror the `source` hash into your observability system. Alerts should trigger when
  the CDN ever serves a `source` hash that does not exist in the manifest; that
  indicates stale deployments or manual file tampering.
- Keep the TTL at the default 30 days. Because Brotli delivers the smallest payload,
  it is safe to let it ride the longest caches. The hashed filename ensures updates
  invalidate the cache automatically.

### gzip fallback path

- When Brotli is missing from `Accept-Encoding`, fall back to the `.gz` companion.
  gzip still delivers a ≥70% reduction for JS/CSS and guarantees compatibility with
  legacy user agents.
- gzip responses must also emit `Vary: Accept-Encoding` so that Brotli-capable
  clients are not accidentally served the larger payload from a shared cache.
- Use the same TTL as Brotli. Because both files are generated from the same source
  and hash, they can share invalidation rules.

### Non-compressible fallback

- If the client omits `Accept-Encoding` entirely, serve the original asset and add
  `Cache-Control: public, max-age=86400` for the uncompressed path. These requests
  are rare (typically legacy bots), so the shorter TTL keeps the footprint small
  without bloating caches.
- Keep observability hooks in place: log whenever an origin asset is served without
  compression so SRE can monitor for regressions or bot floods.

## Sourcing the manifest from CI

The Node 20 shard of the `CI` workflow publishes the manifest alongside the static
build so release managers never have to rebuild locally. Two artifacts ship the
data we need: `compressed-bundle` (the manifest plus compressed assets) and
`pagefind-index` (the searchable HTML mirror).

1. Navigate to the workflow run in GitHub Actions.
2. Download the `compressed-bundle` artifact (UI) or run:

   ```bash
   gh run download <run-id> --name compressed-bundle --dir artifacts/compressed
   ```

   The archive contains `dist/.compressed-manifest.json` together with every
   pre-compressed `.br`/`.gz` asset so SRE can diff payloads offline or rehydrate
   them into the CDN without rebuilding locally.

3. Download the `pagefind-index` artifact (UI) or run:

   ```bash
   gh run download <run-id> --name pagefind-index --dir artifacts/pagefind
   ```

   This bundle keeps the searchable HTML mirrored for cache validation.

4. Feed the manifest into your deployment automation. For Wrangler-based releases,
   the deploy job can push the manifest into Workers KV before activating new
   routes.

Because the manifest is published on every run, downstream tooling can diff hashes
between builds to identify unexpected asset churn before a release is promoted.

## Operational checklist

- [ ] Confirm the latest manifest has been ingested and versioned in the CDN config
      repository or KV namespace.
- [ ] Validate that Brotli responses include `Content-Encoding: br` and
      `Vary: Accept-Encoding` via `curl -H 'Accept-Encoding: br'`.
- [ ] Validate the gzip fallback with `curl -H 'Accept-Encoding: gzip'`.
- [ ] Inspect metrics for the `uncompressed` fallback path; repeated hits indicate
      negotiation drift.
- [ ] After deployment, run the synthetic smoke (`npm run workers:synthetic:dry-run`)
      to ensure edge rewrites are serving the hashed assets advertised in the
      manifest.

Future changes to the compression pipeline must update this playbook so operations
stays aligned with the automated guarantees baked into the build.
