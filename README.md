# Apotheon.ai Web Platform

Apotheon.ai now ships on top of an **Astro static-first architecture** optimized for
enterprise documentation, marketing, and product surfaces. Static HTML delivers
instant performance across global CDNs while **React islands** hydrate only the
interactive moments that truly need it. Tailwind CSS, MDX-driven content
collections, and Pagefind search keep future teams productive without bespoke
scaffolding.

## Tech Stack Overview

- **Framework:** [Astro 4](https://astro.build/) with TypeScript and MDX support
- **Styling:** Tailwind CSS with centralized global tokens
- **Interactive islands:** React 18, hydrated on demand with `client:*`
- **Search:** Pagefind static indexing (`npm run pagefind:index`)
- **Images:** `@astrojs/image` powered by Sharp for responsive, optimized media
- **Content collections:** Strongly typed blog + marketing collections ready for
  MDX adoption
- **Tooling:** ESLint + Stylelint + Prettier with Husky/commitlint automation for
  zero-drift code quality

## Architecture

- [Architecture Decision Ledger](docs/architecture/DECISIONS.md) — canonical ADRs covering Astro SSG, Tailwind + Radix, Pagefind, and Cloudflare platform services with security boundaries and performance budgets.
- [System context diagram](docs/architecture/system-context.svg) — browser ↔ Cloudflare edge ↔ Workers/D1/KV/R2 data flows with boundary notes.
- [Managed service alternatives](docs/infra/ALTERNATIVES.md) — vetted OSS/free substitutes and operational guidance aligned to [`docs/ai-instructions.md`](docs/ai-instructions.md).

## Repository Structure

```
├─ src/
│  ├─ components/islands/  # React islands, hydrated only when needed
│  ├─ content/             # Astro content collections (blog, marketing)
│  ├─ layouts/             # Shared layout shells that load global styles once
│  ├─ pages/               # `.astro` routes, statically generated
│  ├─ styles/              # Tailwind-powered global styles
│  └─ env.d.ts             # Ambient types for Astro and React JSX
├─ public/                 # Static assets copied directly into the build
├─ astro.config.mjs        # Astro configuration (CSP, integrations, build)
├─ tailwind.config.mjs     # Tailwind scanning + design tokens
├─ postcss.config.cjs      # Autoprefixer + Tailwind pipeline
└─ package.json            # Scripts, dependencies, automation hooks
```

> **Why Astro?** The platform favors static delivery with opt-in hydration. That
> keeps Core Web Vitals well within enterprise SLAs and reduces operational
> overhead compared to maintaining a monolithic SPA.

## Getting Started

1. **Install prerequisites**

   - Node.js ≥ 18 (LTS recommended)
   - npm ≥ 9

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Astro prints a local URL (default `http://localhost:4321`) with file watching
   and on-demand React island hydration.

4. **Run automation scripts**

   ```bash
   npm run lint           # ESLint + Stylelint across Astro, TS/TSX, MDX, and CSS
   npm run lint:eslint    # Script-focused lint pass only
   npm run lint:styles    # Tailwind-aware Stylelint for stylesheets and <style> blocks
   npm run format         # Prettier --write with Astro + Tailwind class sorting
   npm run format:check   # Formatting verification for CI or pre-push checks
   npm run typecheck      # Astro's type- and content-aware analysis
   npm run test           # Aggregated lint + typecheck gate mirroring CI
   npm run build          # Static production build (dist/)
   npm run preview        # Serve the production build locally
   npm run pagefind:index # Build + generate static search index in dist/
   ```

   Husky runs `lint-staged` automatically on commit, so the majority of files are
   auto-fixed before they land in history.

## Security

- **Local HTTPS:** Run `./scripts/security/mkcert-install.sh` once per machine to
  trust the mkcert root CA, then `./scripts/security/mkcert-localhost.sh` to mint
  `certs/localhost-*.pem` certificates. Launch the hardened dev server via
  `npm run dev:https`, which auto-detects the certs and forces Astro into HTTPS
  mode.
- **CSP testing:** The security middleware emits nonce-based CSP headers. In
  dev/preview modes the middleware downgrades to `Content-Security-Policy-Report-Only`
  so you can open the HTTPS site in a browser and iterate without blocking
  hydration. Inspect the terminal running `npm run dev:https` for violation logs
  or instrument the Reporting API tab inside browser devtools.
- **Report collection:** Forward the CSP `report-uri` to the Cloudflare Worker
  stub in `workers/csp-report-handler.ts` once deployed. The handler currently
  logs to the console but is designed to fan out to KV/Queues/SIEM endpoints.
- **Playbook:** See [`docs/security/LOCAL_HTTPS.md`](docs/security/LOCAL_HTTPS.md)
  for end-to-end automation covering mkcert setup, Astro HTTPS flags, and
  troubleshooting tips.

## Typography & Self-Hosted Fonts

- **Inter Variable via @fontsource:** `@fontsource-variable/inter` is installed
  as a production dependency so the entire font family is bundled during `astro build`.
  Importing the package from `src/styles/global.css` ensures the `@font-face`
  declarations resolve against locally served assets.
- **Tailwind integration:** `tailwind.config.mjs` prioritizes the `Inter Variable`
  family so the `font-sans` utility automatically maps to the self-hosted font
  while retaining system fallbacks.
- **Operational guidance:** If additional weights or families are needed, prefer
  the [`@fontsource`](https://fontsource.org/) ecosystem to keep delivery within
  our origin. Avoid `<link>` tags to third-party font CDNs; they violate the
  default CSP and introduce availability risk. See
  [`docs/security/FONT_HOSTING.md`](docs/security/FONT_HOSTING.md) for the
  step-by-step playbook.

## Content & Search Workflow

- Drop MDX/Markdown files into `src/content/blog` or `src/content/marketing`. The
  Zod schemas in `src/content/config.ts` guarantee consistent frontmatter.
- `npm run build` emits static HTML to `dist/`. Running `npm run pagefind:index`
  immediately afterwards generates a searchable index consumed client-side with
  zero additional infrastructure.
- React islands live in `src/components/islands/` and can be imported into any
  `.astro` template with hydration directives like `client:load` or
  `client:visible`.

## Deployment

The project outputs plain static assets. Deploy via Cloudflare Pages, Netlify,
Vercel, S3/CloudFront, or any static-friendly CDN. Because CSP defaults are set
in `astro.config.mjs`, most hosts require no extra headers configuration.

## Contributing

1. Fork or branch from `main`.
2. Build features within Astro pages or MDX collections; prefer islands for
   isolated interactivity.
3. Run `npm run test` (aggregates lint + typecheck) and `npm run build` before
   opening a PR.
4. Commit messages must follow Conventional Commits; the Husky `commit-msg` hook
   provides immediate feedback.
5. Document changes in the **Changelog** and relevant docs under `/docs`.

Apotheon.ai continues to prioritize automation, scalability, and zero-trust
security. This Astro foundation minimizes manual plumbing so teams can focus on
high-leverage AI experiences.
