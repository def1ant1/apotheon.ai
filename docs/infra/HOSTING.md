# Hosting Playbook

This document captures the operational contracts our hosting providers must honor so the
static Astro build remains resilient under failure conditions.

## Custom Error Pages

- **404** – Served statically from `/404/index.html`. No additional configuration is required for
  CDN providers that respect directory-style index files.
- **500** – Map all origin 500 responses to the static asset emitted at `/500/index.html`.
  - **Cloudflare Pages** – Navigate to **Project → Settings → Custom error pages** and add a
    `500` entry that points to `/500/index.html`. Cloudflare clones the asset to every colo so the
    fallback renders even when the origin is down. Reference the official guidance at
    [developers.cloudflare.com/pages/configuration/serving-pages/#custom-error-pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#custom-error-pages).
  - **Other CDNs** – Implement an equivalent rule or edge function so 500 responses are rewritten
    to `/500/index.html` and cache them with `stale-while-revalidate` semantics. This keeps the
    failure experience consistent and predictable for SRE runbooks.

## Deployment Checklist

1. Build the static artifact via `npm run build`. This emits the `/404` and `/500` directories with
   their respective `index.html` files.
2. Upload the `dist/` directory to your CDN or static host.
3. Apply the 500 rewrite rule described above. Document the configuration inside the
   infrastructure-as-code repository or the Pages project UI to avoid drift.
4. Smoke test the `/500` route using the host's preview URL to confirm headers, caching policy,
   and navigation flows match expectations.

## Incident Automation Hooks

- All error pages lean on `src/components/system/ErrorPageShell.astro`. If future runbooks require
  additional instrumentation (e.g., embedding a maintenance-mode banner or incident timeline), add
  props/slots to that component so every error page inherits the enhancement automatically.
- Keep observability metadata (request IDs, trace headers) visible on the 500 page to accelerate
  triage. When new headers are introduced, update the copy and embed tooltips or modals as needed.
