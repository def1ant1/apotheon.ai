# Privacy & Analytics Runbook

This document describes how Apothéon captures analytics while honouring global
privacy regulations. Engineering, security, and go-to-market teams should use
it as the canonical reference when shipping new telemetry or reviewing PRs.

## Consent flows

1. **ConsentManager island** renders the Klaro-driven modal. User selections
   persist to `localStorage` under the `apotheon_privacy_consent` key and are
   broadcast via the headless API (`window.__APOTHEON_CONSENT__`).
2. **Analytics helper** (`src/utils/analytics.ts`) inspects the consent API,
   visitor DNT/GPC preferences, and session identifiers before dispatching a
   beacon. The helper never emits events when consent is withheld.
3. **Cloudflare Worker** (`workers/analytics-proxy.ts`) receives the beacon,
   enforces rate limits, validates Cloudflare geo headers, signs the payload, and
   forwards it to the Umami backend defined in `infra/analytics/`.
4. **Opt-out fallbacks**: when consent is absent the helper triggers `onOptOut`
   callbacks so islands can respond gracefully (e.g., log to console, skip GTM
   pushes). No network traffic occurs in this case.

## Data retention

- **D1 audit table** (`analytics_forwarding_audit`) stores only metadata: event
  name, session ID, Cloudflare ray ID, response status, and country code.
- **Rate-limit KV** entries expire automatically based on the configured window
  (default 60 seconds).
- **Umami** retention is configured via Umami’s dashboard; staging defaults to
  180 days. Production updates require a PR so security can review.

## Escalation runbook

| Scenario                  | Immediate action                                                                                                          | Follow-up                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Proxy returning 4xx       | Run `wrangler tail --env analytics_proxy` to inspect logs. Validate that the Worker sees geo headers and allowed origins. | Update `ANALYTICS_ALLOWED_ORIGINS` or audit client beacons.                           |
| Backend 5xx               | Use `make local-logs` or `terraform apply` outputs to confirm Umami is healthy.                                           | File an incident in PagerDuty; include Worker audit rows and Terraform state version. |
| Consent UI failing        | Load `/` with devtools console; invoke `window.__APOTHEON_CONSENT__.get()` to inspect state.                              | Run Vitest + Playwright suites; confirm `localStorage` writes succeed.                |
| Rate-limit false positive | Query the D1 audit table via `wrangler d1 execute`.                                                                       | Tune `ANALYTICS_RATE_LIMIT_MAX`/`WINDOW_SECONDS` and document changes in this file.   |

## Reviewer checklist

- [ ] Consent toggles map to services defined in `config/privacy/klaro.config.ts`.
- [ ] New analytics emitters call `trackAnalyticsEvent` with an explicit
      `consentService` and `onOptOut` handler.
- [ ] Worker bindings (`wrangler.toml`) include KV + D1 resources and migrations.
- [ ] Infrastructure changes provide Makefile/Terraform automation; no manual UI
      steps remain.
- [ ] Tests updated: Vitest for helpers, Miniflare contract tests, and Playwright
      coverage for consent states + geo overrides.
- [ ] Compliance metadata (retention periods, contact points) documented here.
