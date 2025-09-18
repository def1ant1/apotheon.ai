ai-instructions.md
# Apotheon.ai — AI Instructions & Engineering Playbook
**Purpose:** This document is a *complete, enforceable rule‑set* for developing, securing, documenting, testing, releasing, and operating the **Apotheon.ai** public website. It binds humans and AI agents to the same standards.

---

## 0) Non‑Negotiables (Read First)
1. **Security by default.** No feature ships that weakens CSP, form validation, or data handling. Secrets never enter the repo or client.
2. **Static‑first.** Pages are pre‑rendered; hydrate only what’s interactive (nav, forms, modals).
3. **OSS/Free stack or custom.** No paid/closed dependencies for core site operation.
4. **Performance budgets:** Mobile (p75): **LCP < 2.5s**, **INP < 200ms**, **CLS < 0.1**. CI blocks regressions.
5. **Accessibility:** WCAG **2.2 AA** minimum across all flows.
6. **Lead quality:** All forms **reject free/disposable emails**; capture only minimum data.
7. **Documentation & logs:** Every change updates **CHANGELOG.md**, issues **BACKLOG.md** (or boards) are curated weekly, and user/dev docs live under **/docs** with versioned updates.
8. **No unpublished IP.** Public pages describe capabilities; never expose internal methods, keys, or sensitive diagrams.

---

## 1) Architecture & Stack (free/OSS or custom)
- **Framework:** **Astro** (TypeScript, MDX), **React islands** only as needed.
- **UI:** **TailwindCSS** + **Radix Primitives** (accessible headless UI) + custom SVG icon set.
- **Search:** **Pagefind** (static, zero runtime).
- **Analytics:** **Umami** or **Plausible CE** (self‑host), proxied; blocked until consent.
- **Consent:** **Klaro** (MIT).
- **Hosting & Edge:** **Cloudflare Pages** (static) + **Workers** (APIs/OG image) + **KV/D1/R2** (rate‑limit, leads, assets). OSS‑only fallbacks documented in `/docs/infra/ALTERNATIVES.md`.
- **Testing:** Vitest + Testing Library (islands), Playwright (E2E), axe/pa11y (a11y), Lighthouse CI (CWV), OWASP ZAP (DAST).
- **CI/CD:** GitHub Actions + Wrangler; OIDC to Cloudflare (no static secrets).

---

## 2) Repository Structure (authoritative)
