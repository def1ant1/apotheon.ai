docs/workplan/EPICS_AND_WORK_ITEMS.md

# Apotheon.ai Website — Large Work Items (Epics) for Codex

> **Goal:** Build and launch the public **apotheon.ai** website using **free / open‑source or custom‑developed** components that **maximize scalability, performance, and security**.
> **Strategy:** **Static‑first, edge‑enhanced** architecture: **Astro (TypeScript, MDX)** + **React islands (minimal JS)** + **TailwindCSS** + **Radix Primitives** (accessible headless UI).
> **Edge & Hosting:** **Cloudflare Pages** (global CDN, WAF, DDoS) + **Cloudflare Workers/D1/KV/R2** for forms, gating, and signed downloads (all with free tiers).
> **Content:** Git‑based MDX (no vendor lock‑in). Optional OSS CMS (Decap CMS) toggle.
> **Analytics/Consent:** **Umami** (self‑hosted) or **Plausible CE** (AGPL) + **Klaro** (MIT) for consent.
> **Search:** **Pagefind** (OSS static search, zero runtime).  
> **CI/CD & Security:** **GitHub Actions** (public repo free), **OWASP ZAP** DAST in CI, **Gitleaks** secret scanning, **Dependabot**/npm‑audit, **Snyk CLI (OSS)** optional.  
> **Observability:** **GlitchTip** (OSS Sentry‑compatible) or **Sentry self‑host**, **Uptime‑Kuma** (OSS).
> **Note:** All third‑party services are free‑tier or OSS; where SaaS is chosen (e.g., Cloudflare), an OSS/self‑host alternative is listed in the Epic.

> **Orientation cue:** Anchor discussions to the [README hero pledge](../../README.md#apotheonai-web-platform), [Quick Start automation flow](../../README.md#quick-start), and cross-check against the [ROADMAP](../../ROADMAP.md) so epics, roadmap increments, and delivery posture stay synchronized.

---

## EPIC 00 — Program Setup & Architecture Decisions

**Goal:** Foundation optimized for performance (CWV), security, and maintainability.

- **Status:** ✅ Radix primitives now wired into the Astro shell with documented workflows
  covering hydration, Tailwind tokens, and accessibility expectations.
- **Next checkpoint:** Extend the Radix pattern to the global header/footer once the
  remaining layout epics are prioritized.
- **Owner:** Web platform engineering

- **Decisions/Deliverables**
  - Framework: **Astro** (MIT) + **TypeScript** + **MDX**; **React islands** only where interactivity is needed (menus, forms).
  - UI: **TailwindCSS** + **Radix UI primitives** (headless, accessible). Optional icons: **Lucide** / custom SVGs.
  - Typography: **Self-hosted variable fonts** via `@fontsource` packages; external font CDNs are prohibited to maintain CSP fidelity.
  - Content: Astro **Content Collections** for blog & pages; whitepapers as static assets (R2) with signed links.
  - Build: Static pre‑render (SSG) for all pages; islands hydrate on demand; images via **astro:assets** (Sharp service).
  - Repo: Monorepo (if needed) or single app; Prettier, ESLint, stylelint; commitlint + Husky; Conventional Commits.
  - CI: GitHub Actions (build/lint/test), Pagefind index build, Lighthouse CI budgets, ZAP scan, Gitleaks.
  - Dev server security: sample CSP, local HTTPS (mkcert) for parity with prod.
- **Acceptance Criteria**
  - `DECISIONS.md` & architecture diagram checked in.
  - CI green on lint/typecheck/build; Lighthouse budgets wired; ZAP and Gitleaks steps present.

---

## EPIC 01 — Brand System & Design Tokens (OSS)

**Goal:** Elegant enterprise design with tokenized theming.

- **Status:** ✅ Completed — Ladle documentation pipeline with automated a11y + visual checks is operational and design tokens are fully documented.

- **Deliverables**
  - `brand/STYLEGUIDE.md`: palette (dark & light), typography scale, spacing, radii, shadows.
  - Tokenized **Tailwind config**; prefers system fonts for perf; variable fonts optional (subset + preload).
  - Icon set: custom SVGs for **Clio, Hermes, THEMIS, Morpheus, Mnemosyne**, and 6 industries.
  - Favicon + PWA icons (use provided 512x512 asset).
  - Component library docs (Storybook **Chromatic** alt → **Ladle** OSS if lighter).

- **Work Items**
  - **Document the brand system** — Create `docs/brand/STYLEGUIDE.md` capturing the light/dark palettes, typography scale, spacing/radii/shadow tokens, usage tables, and instructions for running an automated WCAG contrast audit script so designers and engineers share a single source of truth.
  - **Codify multi-theme design tokens** — Expand `tailwind.config.mjs` (and supporting files such as `src/styles/global.css` and a new `src/styles/tokens.(css|ts)`) to expose semantic color, typography, spacing, radii, and shadow tokens via CSS variables for both themes, prefer the system stack before optional variable fonts to eliminate layout shift, and annotate the tokens with inline comments.
  - **Automate the icon pipeline** — Produce custom SVGs for Clio, Hermes, THEMIS, Morpheus, Mnemosyne, and the six industries under `public/static/icons/brand/`, wire an `svgo` configuration plus an `npm run icons:build` script to normalize/optimize them (and optionally emit React wrappers), and document naming/usage guidance in the style guide.
  - **Automate favicons & manifest metadata** — Use the existing 512×512 master asset to generate favicon/PWA sizes via a script such as `npm run brand:favicons` (pwa-asset-generator or Sharp), refresh `public/favicon.ico`, update `public/manifest.json` and the `<link rel>` tags in `src/layouts/BaseLayout.astro`, and record the regeneration workflow in the style guide.
  - **Stand up component documentation** — Add Ladle (preferred OSS) or Storybook with scripts (`npm run ladle`, `npm run ladle:build`), author stories that showcase the design tokens and navigation components with extensive notes, hook the tool into automation/CI for visual or accessibility checks, and document the workflow for designers/developers.

- **Acceptance Criteria**
  - AA contrast verified; components documented; zero layout shift from web fonts (font‑display: swap or system).

---

## EPIC 02 — Information Architecture & Routing (Astro)

**Goal:** SEO‑friendly, minimal‑JS routing & breadcrumbs.

- **Deliverables**
  - Routes:
    - `/` (Home)
    - `/solutions/[clio|hermes|themis|morpheus|mnemosyne]`
    - `/industries/[healthcare|finance|law|government|military|intelligence]`
    - `/about/[contact|investors|white-papers|history]`
    - `/blog` + `/blog/[slug]`
  - 404/500, sitemap.xml, robots.txt; breadcrumb schema.
  - 2024-06 IA update: Hermes/Themis/Morpheus/Mnemosyne slugs, diagrams, and nav seeds wired with automation guards.
- **Acceptance Criteria**
  - All pages build statically; pagefind index generated; sitemap & robots auto‑generated.

---

## EPIC 03 — Global Layout, Accessible Navigation & Footer

**Goal:** Zero‑bloat shell with WCAG‑compliant dropdowns.

- **Deliverables**
  - Sticky header; **Radix NavigationMenu** for dropdowns; mobile drawer (focus‑trap, aria‑controls).
  - Footer with quicklinks, legal, minimal social; address/contact anchor.
- **Acceptance Criteria**
  - Full keyboard support; screen reader labels; no JS on pages without interactive components.

---

## EPIC 04 — Homepage (AIOS‑first, investor‑led)

**Goal:** High‑impact, low‑latency landing.

- **Sections**
  - Hero (investor primary CTA; demo secondary).
  - AIOS pillars (4‑up features).
  - Product cards (5 modules).
  - Industries preview (6).
  - Platform benefits (ROI, security, continuous learning, scalability).
  - Investor banner + demo banner.
- **Implementation**
  - Minimal images; use **Astro Image** with AVIF/WebP; defer non‑critical JS.
- **Acceptance Criteria**
  - LCP image preloaded; CLS < 0.1; hero ≤ 1s TTFB on edge.

---

## EPIC 05 — Solutions Pages (5)

**Goal:** Public‑safe technical pages; no secret IP.

- **Deliverables**
  - Templated sections: Overview → Key features → Conceptual “How it works” → Use cases → Cross‑links → CTA.
  - One simple SVG diagram per page (no internal IP).
- **Acceptance Criteria**
  - Each page loads with ≤ 50KB critical CSS/JS; passes content review.

---

## EPIC 06 — Industry Pages (6)

**Goal:** Sector value; compliance & security called out.

- **Deliverables**
  - Healthcare, Finance, Law, Government, Military, Intelligence with targeted use‑cases; links to relevant Solutions.
  - Industry visual/icon + CTA (whitepaper + demo).
- **Acceptance Criteria**
  - Reading grade 10–12; internal links intact; Pagefind search returns relevant entries.

---

## EPIC 07 — Contact & Lead Form (Edge Worker, OSS stack)

**Goal:** High‑quality leads; block free emails.

- **Backend (free/custom)**
  - **Cloudflare Worker** API (`/api/contact`): validate with **Zod**, rate‑limit (CF **KV** sliding window), spam honeypot, **Turnstile** (free CAPTCHA), store leads in **Cloudflare D1** (serverless SQLite) or **Supabase/Postgres** (OSS/self‑host).
  - **Domain gate**: open‑source disposable/burner lists + block common free domains (gmail/yahoo/outlook/hotmail/aol/proton/yopmail/etc.) + optional DNS MX lookup.
  - Optional notifications: **Matrix/Slack webhook** (free tier) or email via **postfix** (self‑host) / **smtp relay** (org’s SMTP). Default: store + dashboard (see EPIC 19).
- **Frontend**
  - Accessible form with inline errors; success screen; privacy note.
- **Acceptance Criteria**
  - Free emails rejected w/ friendly message; submissions persisted; 429 on abuse; CSP allows form endpoint only.

---

## EPIC 08 — Investors Page (Thesis + CTA)

**Goal:** Investor narrative, defensibility & compliance.

- **Deliverables**
  - Vision, market, differentiation, regulatory alignment, roadmap summary.
  - Primary CTA → Contact (pre‑select “Investor”).
  - Optional investor brief PDF (stored in R2; signed link).
- **Acceptance Criteria**
  - Copy approved; OG preview fine; conversion event logged.

---

## EPIC 09 — White Papers Library (Gated, Signed URLs)

**Goal:** Gated downloads; trackable, secure access.

- **Backend**
  - Worker endpoint validates Name/Work Email (same gate as contact); store lead; generate **time‑bound signed URL** for **R2** object; log download to D1.
  - Alternative fully OSS: host PDFs in repo + **tokenized one‑time link** via Worker (no R2).
- **Frontend**
  - Library grid; per‑item modal form; success → download + “sent to email” optional (via org SMTP only).
- **Acceptance Criteria**
  - Links expire (configurable TTL); only business emails accepted; audit trail present.

---

## EPIC 10 — History Page (Research Roots)

**Goal:** Narrative + timeline with minimal JS.

- **Deliverables**
  - Responsive timeline; images lazy‑loaded; optional founder quote block.
- **Acceptance Criteria**
  - All content static; a11y timeline nav; images optimized.

---

## EPIC 11 — Blog System (MDX + OSS search)

**Goal:** Thought leadership at launch.

- **Deliverables**
  - `/blog` index, MDX posts, author meta; code/quote styles; RSS/Atom.
  - **Launch posts (5)**: Welcome; AIOS Architecture; Continuous Learning; Integration & Governance; Healthcare Spotlight.
  - **Pagefind** index build step with stemming.
- **Acceptance Criteria**
  - Posts render with zero JS; OG images generated (see EPIC 14); RSS validates.

---

## EPIC 12 — SEO/SMO & Structured Data (Static)

**Goal:** Discoverability with zero runtime cost.

- **Deliverables**
  - Titles/meta, canonical, sitemap/robots; OpenGraph/Twitter meta.
  - **JSON‑LD**: Organization, Website, BreadcrumbList, Article, SoftwareApplication (solutions), FAQ (if added).
- **Acceptance Criteria**
  - Rich Results pass; SEO Lighthouse ≥ 95; no duplicate canonicals.

---

## EPIC 13 — Privacy, Analytics & Consent (OSS)

**Goal:** Privacy‑first measurement.

- **Deliverables**
  - **Umami** (self‑host) or **Plausible CE**; server endpoint proxied to stay within CSP.
  - Events: `lead_investor`, `lead_demo`, `whitepaper_download`, `blog_read`.
  - **Klaro** consent manager; respect DNT; country detection (CF geo).
- **Acceptance Criteria**
  - No PII sent; analytics blocked until consent; dashboards show events.

---

## EPIC 14 — Performance Engineering & OG Images

**Goal:** CWV excellence; dynamic OG images (free).

- **Deliverables**
  - Astro Image pipeline; AVIF/WebP; lazy‑loading; preconnect/preload criticals; route‑level code split.
  - **Lighthouse CI** budgets (Perf ≥ 95 mobile).
  - **OG image generator** Worker using **Satori/ResVG** (OSS) → per‑page OG images at build or edge.
- **Acceptance Criteria**
  - P75 mobile: LCP < 2.5s, INP < 200ms, CLS < 0.1; OG previews correct.

---

## EPIC 15 — Accessibility (WCAG 2.2 AA)

**Goal:** Inclusive by default.

- **Deliverables**
  - Keyboard nav/skip links/focus outlines/landmarks; alt text policy.
  - Automated: **axe-core**, **pa11y-ci**; manual NVDA/VoiceOver pass.
- **Acceptance Criteria**
  - Zero critical axe violations; manual flows pass.

---

## EPIC 16 — Security Hardening (Headers, WAF, CI)

**Goal:** Defense‑in‑depth with free/OSS.

- **Deliverables**
  - Security headers via Cloudflare: **CSP** (nonce + strict‑dynamic), **HSTS** (preload), **X‑CTO**, **X‑Frame‑Options**, **Referrer‑Policy**, **Permissions‑Policy**, **COOP/COEP** (if needed).
  - **OWASP ZAP** CI scan; **Gitleaks**; Dependabot/npm‑audit; SRI for third‑party scripts.
  - Form APIs: Zod validation, rate limiting (KV), Turnstile, CSRF token for POSTs, JSON schema tests.
  - Email domain gating: maintained OSS domain lists + MX DNS check.
- **Acceptance Criteria**
  - ZAP: no Highs; CSP report‑only baseline hardened to block; headers verified.

---

## EPIC 17 — Hosting, Edge & CI/CD (Free tiers)

**Goal:** Global edge delivery; reproducible deploys.

- **Deliverables**
  - **Cloudflare Pages** (static) + **Workers** (APIs/OG) + **D1/KV/R2** (data/files).
  - GitHub Actions: build/test/lint; Pagefind; Lighthouse; ZAP; deploy via `wrangler`.
  - Infra as code: `wrangler.toml`, headers config, R2 bucket policy, KV namespaces, D1 schema migrations.
  - Secrets via GitHub OIDC → Cloudflare (no static secrets in CI).
- **Acceptance Criteria**
  - PR previews enabled; zero‑downtime deploy; one‑click rollback; infra files versioned.

---

## EPIC 18 — QA & Cross‑Browser/Device Testing

**Goal:** Confidence across environments.

- **Deliverables**
  - Unit/integration tests (Vitest + Testing Library for islands); E2E (**Playwright**) for forms, gating, nav.
  - Visual regression (Playwright screenshots).
  - Link checker (lychee); 10‑device/5‑browser matrix.
- **Acceptance Criteria**
  - ≥80% coverage on critical islands; all E2E pass; no broken links.

---

## EPIC 19 — Content Workflow & Optional OSS CMS

**Goal:** Non‑dev updates with governance.

- **Deliverables**
  - MDX authoring guide; content lint (Vale); PR review flow.
  - Optional **Decap CMS** (OSS, Git‑based) for blog/pages behind protected route; Netlify auth alternative: **Keycloak** (OSS) SSO if needed.
  - Simple **Lead Viewer** admin (read‑only) on D1 (protected by basic auth/IP allowlist) — OSS template.
- **Acceptance Criteria**
  - Non‑dev can publish a post via PR or CMS; lead viewer shows stored submissions securely.

---

## EPIC 20 — Launch Readiness & Go‑Live

**Goal:** Safe, observable launch.

- **Deliverables**
  - Launch checklist (DNS, cache warm, purge, monitor); synthetic tests (Workers) for contact & download.
  - **Uptime‑Kuma** monitors; **GlitchTip/Sentry** error capture; real‑time CWV (CrUX API optional).
- **Acceptance Criteria**
  - All checks green; alerting live; rollback tested.

---

## EPIC 21 — Post‑Launch Growth (OSS Experimentation)

**Goal:** Iterative improvement.

- **Deliverables**
  - **GrowthBook OSS** (feature flags/A‑B) wired client/server.
  - Content calendar; auto‑OG for blog; social share cards.
- **Acceptance Criteria**
  - First experiment configured; KPIs dashboard created (Umami/Plausible).

---

## EPIC 22 — Assets & Media Production (OSS pipeline)

**Goal:** Complete visual inventory, optimized.

- **Deliverables**
  - SVG icon set (7+11); background textures; section illustrations.
  - Asset optimization scripts (SVGO, Imagemin); AVIF/WebP outputs.
- **Acceptance Criteria**
  - All assets ≤ required sizes; CLS safe; licenses documented.

---

## EPIC 23 — i18n Scaffold (Optional, OSS)

**Goal:** Future‑proof localization.

- **Deliverables**
  - `astro-i18next` scaffold; copy keys externalized; locale switch hidden.
- **Acceptance Criteria**
  - en baseline externalized; adding locale = content task only.

---

## EPIC 24 — Legal & Compliance Pages

**Goal:** Publish mandatory policies.

- **Deliverables**
  - Privacy Policy, Terms, Cookie Policy; DSAR stub (email link).
  - Cookie banner integrated with Klaro config.
- **Acceptance Criteria**
  - Footer links live; last‑updated dates; consent wiring tested.

---

## EPIC 25 — Security Operations & Runbooks (OSS)

**Goal:** Fast response to incidents.

- **Deliverables**
  - Runbooks: form API abuse, R2 leak, CSP violation triage (CSP report‑only endpoint Worker).
  - Scheduled backups: D1 export, R2 lifecycle rules; integrity checksums.
- **Acceptance Criteria**
  - Tabletop exercise complete; backups verified restore.
