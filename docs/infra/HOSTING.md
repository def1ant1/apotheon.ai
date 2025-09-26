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

## Synthetic Monitoring as Code

- **Uptime-Kuma provisioning**
  - Use the REST API to manage monitors so staging/prod stay identical. Example:
    ```bash
    curl -X POST "$UPTIME_KUMA/api/monitor/add" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $UPTIME_KUMA_TOKEN" \
      -d '{
        "name": "Apotheon Contact API",
        "type": "http",
        "url": "https://apotheon.ai/api/contact",
        "method": "POST",
        "body": "{\"probe\":\"synthetic\"}",
        "interval": 60,
        "maxretries": 1
      }'
    ```
    Store the cURL snippets (or Terraform equivalents) in `infra/uptime-kuma/` so diffs drive
    monitor changes.
- **GlitchTip/Sentry automation**
  - Automate project creation and DSN retrieval via API instead of clicking through the UI:
    ```bash
    curl -X POST "https://glitchtip.example.com/api/0/organizations/apotheon/projects/" \
      -H "Authorization: Bearer $GLITCHTIP_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name":"apotheon-ai-web","platform":"javascript"}'
    ```
  - Pipe the resulting DSN into a secret manager (`wrangler secret put GLITCHTIP_DSN`) so Workers
    and Astro builds stay in sync without copying values manually.
- **IaC integration**
  - Wrap both APIs with Terraform modules (use `terraform-provider-http` or custom providers) and
    commit the modules alongside the Cloudflare Pages/Worker configuration. The CI pipeline runs
    `terraform plan` on every PR to highlight monitor drift before merge.

## Automated Status Signals

- The synthetic Worker writes every run to D1. Use the same database to power the on-site incident
  banner and external status dashboards. Expose read-only replicas to BI tools via Wrangler `d1
execute` scripts stored in `infra/d1/`.
- Keep the incident banner React island wired to the Worker endpoint and include a manual override
  flag (`SYNTHETIC_ALERT_WEBHOOK`) so incident commanders can simulate failures during drills without
  mutating production tables.
