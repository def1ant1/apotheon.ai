# Blog Editorial Playbook

This guide translates the automated blog pipeline into a repeatable editorial workflow. Every entry in `src/content/blog/`
ships with inline comments—treat this document as the narrative companion for deeper context.

## Metadata Checklist

- **Title & description** – Keep titles action-oriented and limit descriptions to 160 characters. These feed search snippets,
  social cards, and the `<title>` tag.
- **Dates** – `publishDate` drives ordering, RSS feeds, and JSON-LD. Update `updatedDate` whenever material changes land; the
  author bio component will surface it automatically.
- **Hero assets** – Store SVG/PNG artwork in `/public/images/blog/`. Reference the path in `heroImage` and describe the visual
  in `heroImageAlt`. The page template renders a caption using the alt text so readers understand the illustration context.
- **Tags** – Lowercase, kebab-case tokens (e.g., `governance`, `risk-management`). Tags fuel related content, future search
  filters, and analytics breakdowns.
- **Reading time** – Provide a rounded minute count. Automation will eventually backfill this using a script; until then,
  calculate manually after the draft stabilizes.
- **Author block** – The `author` object powers the shared `<AuthorBio>` component and JSON-LD schema. Keep bios under 320
  characters and include optional social links for trust signals.

## Draft Management

- Set `draft: true` for in-progress articles. Drafts display during `npm run dev` sessions but are excluded from production
  builds and static exports.
- To share a build artifact with stakeholders while keeping drafts hidden from the live site, run `npm run build -- --drafts`
  and inspect `dist/` locally. Never upload this build—CI runs `npm run build` without the flag to guarantee drafts stay private.
- Draft placeholders should capture outline bullets and next steps. Schema validation ensures we never lose metadata fidelity,
  even when copy is still rough.

## Publishing Workflow

1. Convert the draft to polished copy, source final hero art, and flip `draft` to `false`.
2. Run the automation suite locally:
   - `npm run lint` (Vale now checks `.md`/MDX copy for inclusive language and placeholder text.)
   - `npm run typecheck`
   - `npm run build`
   - `npm run test`
3. Submit the PR. The shared components automatically emit JSON-LD, author bios, and related content, so reviewers only need to
   focus on storytelling quality.

## Extending the Experience

- **Search & filters** – The blog index already sorts and slices posts. When introducing pagination or faceted search, reuse the
  helper variables defined in `src/pages/blog/index.astro` and consider hydrating an island if analytics calls for client-side
  filtering.
- **Structured data** – `src/pages/blog/[slug].astro` outputs Article schema. Breadcrumb JSON-LD is stubbed for future global
  navigation work—coordinate with the platform team before introducing new schema blocks.
- **Components** – Keep layout tweaks inside `src/components/blog/`. Typed props ensure downstream consumers (marketing site,
  syndication feeds, etc.) stay compatible with the content contract.

## Support

Questions? Drop them in `#content-systems` on Slack or open a GitHub Discussion tagged `blog`. Continuous improvement notes
should land in this document, `docs/dev/BLOG.md`, or inline in the starter MDX files so automation has one canonical source of
truth.
