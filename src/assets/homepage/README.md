# Homepage Hero Artwork Notes

- **Canvas:** 1440×960 px PNG tuned for Astro Image LCP hints.
- **Palette:** Deep navy (#091730 → #240C40) gradient anchors the enterprise tone, with cyan (#5EEAD4), magenta (#F472B6), amber (#FCD34D), and indigo (#818CF8) accents that already exist in our UI kit for cohesive reuse.
- **Lighting:** Radial highlight is biased to 62% × 38% of the canvas to guide focus toward the analytics panel while preserving left-side whitespace for H1 copy. Peripheral vignette keeps WCAG contrast > 4.5:1 for overlaid white text.
- **Narrative:** Central dashboard reflects an autonomous operations cockpit; floating right-hand cards evoke distributed teams/devices syncing in real time.
- **Accessibility:** Soft grid and particle layers stay under 12% opacity so screen readers relying on alt text are not contradicted by noisy visuals. Contrast testing against #F8FAFC body text and #38BDF8 CTAs passes AAA large text thresholds.
- **Automation:** Artwork is procedurally generated on demand via `npm run ensure:homepage-hero-media`, which shells into `scripts/design/render-homepage-hero.py` before minting AVIF/WebP derivatives. No binary hero assets live in git; the ensure script rebuilds them deterministically during CI and local workflows.

## Operational runbook

1. Install Python ≥ 3.10. The ensure script auto-detects the interpreter from `HOMEPAGE_HERO_PYTHON`, `$PYTHON`, or the system `python3`/`python` binary and will `pip install pillow` automatically if the module is missing.
2. Run `npm run ensure:homepage-hero-media`. This task renders `hero-base.png` (ignored by git), derives AVIF/WebP companions, and refreshes `src/generated/image-optimization.manifest.json` with checksums + dimensions for Astro’s image service.
3. Inspect the Ladle "Homepage/Hero Illustration" story (`npm run ladle`) or open `src/assets/homepage/hero-base.png` locally for visual QA.
4. If the narrative focus changes, sync the alt text in `src/content/homepage/landing.mdx` so assistive technologies and analytics reports stay aligned.

> Future designers: update this file when adjusting palette/lighting so product marketing knows how the visual narrative supports the copy.
