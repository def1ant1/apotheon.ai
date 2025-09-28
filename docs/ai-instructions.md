# Apotheon.ai — AI Instructions & Engineering Playbook

**Purpose:** Enforce a unified rule-set for engineering, documenting, testing,
releasing, and operating the public-facing Apotheon.ai web experience.

---

## 0) Non-Negotiables

1. **Security by default** — Uphold the CSP defined in `astro.config.mjs`. Never
   inline scripts/styles without hashed allowances. Secrets never enter the repo.
2. **Static-first delivery** — Prefer pre-rendered `.astro` or MDX content.
   Hydrate React islands only where user interactions demand it.
3. **Open stack** — Core site functionality must rely on OSS or self-hostable
   tools (Astro, Tailwind, Pagefind, etc.).
4. **Performance budgets** — Mobile (p75) targets: **LCP < 2.5s**, **INP < 200ms**,
   **CLS < 0.1**. Automate Lighthouse/PageSpeed checks in CI before launch.
5. **Accessibility** — Maintain WCAG 2.2 AA. Use semantic HTML, focus states, and
   run automated axe scans on new flows.
6. **Minimal data capture** — Forms collect the least data necessary and block
   disposable emails. Log consent for analytics before enabling trackers.
7. **Documentation discipline** — Update `CHANGELOG.md`, `/docs`, and inline
   comments with every change. Architecture decisions flow through this playbook.
8. **No unpublished IP** — Keep copy high-level and scrub confidential diagrams
   or API secrets.

---

## 1) Architecture & Stack

- **Framework:** Astro 4 + TypeScript + MDX (`@astrojs/mdx`)
- **Styling:** Tailwind CSS via `@tailwindcss/vite`, PostCSS + Autoprefixer
- **Islands:** React 18 components hydrated with Astro `client:*` directives
- **Search:** Pagefind CLI for static index generation (wired into `npm run build`, manual rerun `npm run search:index`)
- **Images:** `astro:assets` backed by Sharp for responsive assets
- **Content:** Astro Content Collections for `blog` & `marketing` MDX
- **Hosting:** Static CDNs (Cloudflare Pages preferred) with CSP headers honored
- **Automation:** Astro check, Prettier, future Vitest/Playwright/axe suites

---

## 2) Repository Expectations

```
src/
  components/islands/   → React islands with exhaustive comments & tests
  content/              → MDX sources validated by Zod schemas
  layouts/              → Base layouts importing `src/styles/global.css`
  pages/                → `.astro` routes (include accessibility annotations)
  styles/               → Tailwind entrypoints, custom tokens
```

- Keep React islands isolated and documented for hydration strategy.
- Use content collections for any new marketing/blog content to avoid rework.
- Global automation lives in `package.json` scripts; extend rather than rewrite.

---

## 3) Automation & Quality Gates

- `npm run lint` → Astro semantic/type-aware analysis (must pass)
- `npm run check` → Run before PRs to surface type drift early
- `npm run format` → Enforce Prettier formatting (CI-ready)
- `npm run build` → Guarantees static output compiles and passes CSP checks
- `npm run search:index` → Rebuilds the Pagefind index against an existing
  `dist/` when content changes outside the core build loop
- Future additions: Vitest for islands, Playwright for flows, axe/pa11y for a11y,
  Lighthouse CI and OWASP ZAP for performance/security

---

## 4) Delivery Workflow

1. Ideate + spec features with automation-first mindset; prefer config-driven
   options over manual steps.
2. Implement within Astro pages/MDX, leaning on Tailwind utilities and content
   collections to minimize bespoke CSS/markdown plumbing.
3. Document any new patterns inside `/docs` and inline comments so follow-on
   teams inherit institutional knowledge.
4. Run lint/check/build scripts locally. Attach relevant output to PRs.
5. Update the changelog with clear, customer-facing summaries and note any
   follow-up automation tasks required.

---

## 5) Incident & Operations Notes

- CSP violations detected in browsers should be treated as blocking bugs.
- Pagefind index files belong in deploy artifacts; purge caches after releases.
- Monitor CDN analytics for regressions in performance/accessibility budgets.
- Production secrets are managed via platform-specific vaults (Cloudflare
  Environments, GitHub OIDC); never `.env` commit.

This document evolves with the platform. Keep it versioned, reference it in PRs,
and ensure every contributor adheres to the same enterprise-grade standards.
