# Accessibility Quality Program

Apotheon.ai treats accessibility as a release gate. Automation, manual reviews, and
remediation workflows operate together so every marketing and product surface meets WCAG 2.2 AA
expectations before we ship.

## Continuous Testing Cadence

| Phase                    | Command                       | Notes                                                                                                                                 |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Static build validation  | `npm run accessibility:axe`   | Generates per-page axe-core reports under `reports/accessibility/axe/` and fails the build on serious/critical issues.                |
| Pa11y smoke crawl        | `npm run accessibility:pa11y` | Uses Pa11y CI against the built bundle (`dist/`) with WCAG 2.2 AA rules. JSON output lives in `reports/accessibility/pa11y/`.         |
| Unit landmarks           | `npm run test:unit`           | Vitest suites exercise Astro landmarks via the compiler AST and React islands with Testing Library assertions.                        |
| Keyboard & SR automation | `npm run test:e2e`            | Playwright coverage includes skip-link navigation, keyboard focus loops, and form validation messaging across responsive breakpoints. |

Additional CI jobs enforce `npm run lint`, `npm run typecheck`, and `npm run test` so styling,
typing, and SEO budgets stay green alongside accessibility. The consolidated quality gate fails
fast when any accessibility command reports a violation.

> **Playwright browser provisioning**: run `npx playwright install --with-deps chromium` locally
> before the first `npm run test:e2e` execution. CI environments perform the install step during
> provisioning, but local workflows require the one-time bootstrap so Chromium ships with required
> system dependencies.

## Manual Screen Reader Passes

Automation catches regressions, but we still run quarterly manual sweeps across tier-1 flows.
Schedule checks before major campaigns and after any layout refactors.

### NVDA + Firefox

1. Launch NVDA with Firefox ESR.
2. Confirm skip link: press <kbd>Tab</kbd> once on the home page and verify NVDA announces
   "Skip to content"; activate and ensure focus lands on the main region (`role="main"`).
3. Navigate the primary navigation with <kbd>Alt</kbd>+<kbd>Ctrl</kbd>+<kbd>Left/Right</kbd> to confirm
   the Radix menu exposes grouped landmarks and submenus announce labels.
4. Traverse the Contact form; ensure field errors announce via the status region without moving focus.
5. Submit without solving Turnstile to verify NVDA announces the blocking message.

### VoiceOver + Safari

1. Enable VoiceOver (<kbd>⌘</kbd>+<kbd>F5</kbd>) and open Safari.
2. Use <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>U</kbd> to inspect the rotor landmarks list; confirm
   Banner, Navigation, Main, Region (Marketing content), and Contentinfo appear once each.
3. Exercise the Mobile navigation drawer on iPhone/iPad simulator: open menu, ensure focus lands on
   the inline skip link, and escape returns focus to the trigger.
4. Submit the Whitepaper request form with blank Turnstile token; VoiceOver should read the polite
   status update before moving on.
5. Validate that CTA regions expose their labelled heading via the rotor.

Document findings in the release journal and log deviations as remediation tickets.

## Remediation Workflow

1. **Log a ticket** in the Platform Engineering board with:
   - Component/page name
   - Reproduction steps (include screen reader commands if applicable)
   - Screenshot or transcript of the assistive technology output
   - WCAG criterion reference (e.g., "WCAG 2.2.1 Keyboard Accessible")
2. **Tag severity** using our accessibility labels:
   - `a11y:blocker` for issues that prevent task completion (release gate)
   - `a11y:major` for degraded experiences requiring next sprint attention
   - `a11y:minor` for enhancements scheduled during quarterly hardening
3. **Attach automation artifacts**: include links to the failing axe/Pa11y JSON entries or Playwright
   trace to accelerate triage.
4. **Assign owners**: navigation issues go to the Web Platform squad; form issues go to Growth Engineering.
5. **Verify fixes**: update regression tests and rerun the full accessibility command suite before closing.

## Training & Knowledge Transfer

- New engineers complete the internal "Accessible Astro" lab, which pairs the axe-core scripts with
  NVDA walkthroughs.
- Quarterly lunch-and-learn sessions rotate between squads to demo new accessibility utilities and
  review recent remediations.
- Product marketing partners receive a two-page quick reference for writing accessible copy (link text,
  alt text, heading hierarchy).
- Capture tribal knowledge inside the component source via inline annotations—future contributors should
  understand why focus management, skip links, and ARIA landmarks exist before touching markup.

## Release Checklist

- ✅ axe-core summary shows zero critical/serious violations
- ✅ Pa11y CI report shows zero errors
- ✅ Playwright accessibility spec passes on desktop (1280px) and mobile (375px) viewports
- ✅ Manual NVDA + VoiceOver sweeps signed off by QA partner for the release window
- ✅ Remediation tickets filed (or closed) for any exceptions, with owners acknowledged in the release notes

Keeping this checklist green is a prerequisite for merge approval and deployment.

## Visual Snapshot Maintenance

The Open Graph preview regression test stores its deterministic baseline as a base64-encoded text
fixture to comply with our "no binary blobs" repository policy. When legitimate OG template changes
occur, refresh the snapshot with the helper script below so teams do not need to interact with
Playwright's binary screenshot output directly.

```bash
# 1. Launch the development server in a separate terminal.
npm run dev

# 2. Regenerate the baseline using the same API that feeds the production OG worker.
#    The helper strips whitespace so the repository stays diff-friendly.
node scripts/update-og-preview-fixture.mjs

# 3. Review the textual diff under tests/e2e/fixtures/ and commit alongside template changes.
```

If the helper reports unexpected diffs, validate that fonts and system dependencies match CI's
container image. See `playwright.config.ts` for the authoritative browser version.
