# End-to-end contract surfaces

This directory houses the Playwright regression suite that guards our enterprise navigation and marketing
contracts. Specs rely on purpose-built Astro fixtures for deterministic assertions. When adding a new spec,
document the associated fixture here so future contributors understand the shared surfaces.

## Navigation prefetch intent harness

- **Fixture**: `/src/pages/testing/navigation-prefetch.astro`
- **Route**: [`/testing/navigation-prefetch`](http://127.0.0.1:43210/testing/navigation-prefetch)
- **Purpose**: Provides anchored scenarios for pointer intent, viewport intersection, and negative eligibility
  flows. Each link includes `data-prefetch="intent"` so the runtime prefetch manager exercises the same code
  paths production templates rely on.
- **Spec**: `tests/e2e/navigation-prefetch.spec.ts`
- **Guardrails**:
  - Keep the anchor `data-testid` attributes and destination query strings stable; the Playwright spec listens
    for them to assert that network prefetching occurred (or was intentionally skipped).
  - Retain the inline documentation in the fixture to remind future authors why the markup must avoid visual
    redesigns that would break deterministic scroll/hover behaviour.

Run the suite in isolation with:

```bash
npm run test:e2e -- navigation-prefetch.spec.ts
```

The command executes against the dev server defined in `playwright.config.ts` and is safe to run in CI without
additional toggles.
