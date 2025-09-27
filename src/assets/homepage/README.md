# Homepage Hero Artwork Notes

- **Canvas:** 1440×960 px PNG tuned for Astro Image LCP hints.
- **Palette:** Deep navy (#091730 → #240C40) gradient anchors the enterprise tone, with cyan (#5EEAD4), magenta (#F472B6), amber (#FCD34D), and indigo (#818CF8) accents that already exist in our UI kit for cohesive reuse.
- **Lighting:** Radial highlight is biased to 62% × 38% of the canvas to guide focus toward the analytics panel while preserving left-side whitespace for H1 copy. Peripheral vignette keeps WCAG contrast > 4.5:1 for overlaid white text.
- **Narrative:** Central dashboard reflects an autonomous operations cockpit; floating right-hand cards evoke distributed teams/devices syncing in real time.
- **Accessibility:** Soft grid and particle layers stay under 12% opacity so screen readers relying on alt text are not contradicted by noisy visuals. Contrast testing against #F8FAFC body text and #38BDF8 CTAs passes AAA large text thresholds.
- **Automation:** Artwork is procedurally generated on demand via `npm run ensure:homepage-hero-media`, which shells into `scripts/design/render-homepage-hero.py` before minting AVIF/WebP derivatives. When procedural rendering is offline, the script hydrates pre-rendered binaries from `assets/design/homepage/hero/managed-assets.json` after verifying SHA-256 checksums, and only then falls back to a minimal placeholder.

## Managed assets & checksum policy

- `assets/design/homepage/hero/managed-assets.json` stores the version-controlled golden binaries as base64 strings with SHA-256 digests. `hero-render-context.json` captures the Python generator inputs for reproducibility.
- CI invokes `npm run ensure:homepage-hero-media` and fails the build if any checksum diverges from the ledger. This keeps drift visible while still writing a placeholder locally so Storybook/Ladle do not break during outage drills.
- To refresh the golden assets, regenerate them with `python scripts/design/render-homepage-hero.py --output /tmp/hero-base.png`, rebuild derivatives with `sharp` (or rerun the ensure script once with `HOMEPAGE_HERO_ASSET_ROOT=assets/design/homepage/hero`), then run `npm run ensure:homepage-hero-media -- --refresh-managed-ledger` to capture the binaries into `managed-assets.json` before committing.

## Operational runbook

1. Install Python ≥ 3.10. The ensure script auto-detects the interpreter from `HOMEPAGE_HERO_PYTHON`, `$PYTHON`, or the system `python3`/`python` binary and will `pip install pillow` automatically if the module is missing.
2. Run `npm run ensure:homepage-hero-media`. This task renders `hero-base.png` (or hydrates the managed fallback), derives AVIF/WebP companions, and refreshes `src/generated/image-optimization.manifest.json` with checksums + dimensions for Astro’s image service.
3. Inspect the Ladle "Homepage/Hero Illustration" story (`npm run ladle`) or open `src/assets/homepage/hero-base.png` locally for visual QA. Managed hydration ensures the PNG remains 1440×960 even if Python tooling is offline.
4. If the narrative focus changes, sync the alt text in `src/content/homepage/landing.mdx` so assistive technologies and analytics reports stay aligned.
5. When running CI-style drills without Python, export `HOMEPAGE_HERO_DISABLE_RENDER=1` to skip the renderer and force hydration from the managed assets.

> Future designers: update this file when adjusting palette/lighting so product marketing knows how the visual narrative supports the copy. Rev the checksums whenever a golden asset changes.
