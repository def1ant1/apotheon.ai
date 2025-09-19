/**
 * lint-staged keeps our pre-commit hooks snappy by only touching files that changed.
 * The commands are ordered to maximize auto-fix potential while avoiding duplicate work.
 */
const eslintTargets = '**/*.{astro,js,jsx,ts,tsx,mdx}';
const styleTargets = '**/*.{css,pcss,scss,sass,astro}';
const prettierTargets = '**/*.{astro,css,html,js,json,md,mdx,ts,tsx,yaml,yml}';

export default {
  [eslintTargets]: ['eslint --max-warnings=0 --fix'],
  [styleTargets]: ['stylelint --fix'],
  [prettierTargets]: ['prettier --write'],
};
