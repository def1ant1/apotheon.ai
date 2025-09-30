# Navigation Delivery Contract

Enterprise buyers expect deterministic navigation affordances that scale across locales, screen
readers, and motion preferences. This document captures the smooth-scroll/focus contract introduced
for the global header and how to validate it before releasing to staging.

## Smooth scrolling + reduced motion fallbacks

- `src/styles/global.css` assigns `scroll-behavior: smooth` on `<html>` so in-page anchors (skip link,
  table-of-contents entries, etc.) animate consistently across browsers. The behaviour supports WCAG
  2.4.1 (Bypass Blocks) by keeping the skip link predictable for keyboard users.
- An accompanying `@media (prefers-reduced-motion: reduce)` override flips scrolling back to `auto`.
  This satisfies WCAG 2.3.3 / Section 508 expectations by preventing unexpected animation for motion-
  sensitive operators.

## Header focus management

- `src/components/navigation/SiteHeader.astro` wires the skip link to
  `src/utils/accessibility/anchorFocus.ts` via `siteHeader.client.ts`. The helper verifies that each
  anchor references a valid in-page ID, scrolls to the landmark with the appropriate behaviour, and
  then programmatically focuses the element once scrolling settles.
- The utility is intentionally framework-agnostic so other surfaces (marketing table of contents,
  inline “jump to section” links, etc.) can reuse the same helper without adding bespoke scripts.

## Testing workflow

1. **Unit** – `tests/unit/anchor-focus.spec.ts` exercises the utility (scroll behaviour selection,
   focus timing, DOM validation). Extend this suite when adding new focus helpers.
2. **E2E** – `tests/e2e/navigation-skip-link-motion.spec.ts` runs Playwright scenarios for both
   reduced-motion states, asserting scroll behaviour, focus management, and hash updates.
3. **Regression** – run the standard lint/test suites before pushing:

   ```bash
   npm run lint
   npm run test
   npm run test:e2e
   ```

Following this flow keeps the navigation layer audit-ready while minimising manual retesting.
