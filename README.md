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
- **Tooling:** Prettier formatting, Astro check for lint/type safety

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
   npm run lint          # Astro's type-aware checker across .astro/.mdx/.ts(x)
   npm run format        # Prettier --check for consistent formatting
   npm run build         # Static production build (dist/)
   npm run preview       # Serve the production build locally
   npm run pagefind:index # Build + generate static search index in dist/
   ```

   `npm test` currently echoes a placeholder—add Vitest/Playwright suites when
   UI logic appears.

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
3. Run `npm run lint`, `npm run check`, and `npm run build` before opening a PR.
4. Document changes in the **Changelog** and relevant docs under `/docs`.

Apotheon.ai continues to prioritize automation, scalability, and zero-trust
security. This Astro foundation minimizes manual plumbing so teams can focus on
high-leverage AI experiences.
