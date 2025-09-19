/**
 * Enterprise-focused Ladle configuration that keeps React story authoring in lockstep with
 * the production Astro shell. We expose a single config entry point so CI, local dev, and
 * future docs tooling (Chromatic/Chromatic alternatives) all read from the same defaults.
 *
 * See: https://www.ladle.dev/docs/configuration
 */

/** @type {import('@ladle/react').UserConfig} */
const config = {
  /**
   * Scope stories to the dedicated `src/stories` workspace. Co-locating all narratives in a
   * single tree prevents docs drift and simplifies repo access controls when scaling to
   * multiple federated teams.
   */
  stories: 'src/stories/**/*.stories.{tsx,mdx}',

  /**
   * Build artifacts land in `dist/ladle` so CI can publish them alongside the Astro build
   * or upload them to artifact storage for async reviews. Keeping the directory deterministic
   * allows automation scripts to discover the bundle without additional parameters.
   */
  outDir: './dist/ladle',

  /**
   * Vite customizations live in a separate file to keep advanced wiring (tsconfig paths,
   * React SWC plugins, CSP tweaks) version-controlled and lintable. Ladle resolves the path
   * relative to the repo root.
   */
  viteConfig: './ladle.vite.config.mjs',

  /**
   * Enable first-class accessibility tooling directly in the UI. Reviewers can flip the
   * built-in axe panel while engineers rely on `ladle:ci` for automated gatekeeping.
   */
  addons: {
    a11y: { enabled: true },
    source: { enabled: true, defaultState: true },
    ladle: { enabled: true },
  },

  /**
   * Inline copy nudges contributors toward the preview command before cutting releases.
   * This dramatically reduces surprises where the static bundle diverges from the dev
   * server (e.g., due to environment variables or CSP headers).
   */
  i18n: {
    buildTooltip:
      '💡 Tip: `npm run ladle:build` mirrors CI so run it locally before cutting a release branch.',
  },
};

export default config;
