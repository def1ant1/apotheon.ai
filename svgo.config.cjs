/**
 * Apotheon brand SVG optimization config.
 *
 * Goals:
 * - Preserve `viewBox` so responsive sizing remains intact.
 * - Retain `<title>` nodes for accessible labelling.
 * - Normalize precision for deterministic diffs and sharp edges.
 * - Add `focusable="false"` and `role="img"` to guard against IE quirks and aid assistive tech.
 */
module.exports = {
  multipass: true,
  floatPrecision: 3,
  js2svg: {
    indent: 2,
    pretty: true,
    finalNewline: true,
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          convertPathData: {
            floatPrecision: 3,
          },
        },
      },
    },
    { name: 'cleanupIds', active: false },
    { name: 'removeViewBox', active: false },
    { name: 'removeTitle', active: false },
    'removeDimensions',
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          { focusable: 'false' },
          { role: 'img' },
        ],
      },
    },
  ],
};
