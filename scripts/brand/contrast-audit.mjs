#!/usr/bin/env node
/**
 * Apotheon Brand Contrast Audit
 * ------------------------------------------------------------
 * This script acts as the automated source of truth for WCAG 2.2 AA
 * contrast expectations across the design token pairings documented in
 * `docs/brand/STYLEGUIDE.md`. We compute relative luminance using the
 * formula described in WCAG 2.2 §1.4.3 and evaluate each approved
 * foreground/background pairing. The goal is to stop regressions long
 * before QA by letting contributors run `npm run brand:contrast` as part
 * of their local verification flow.
 */

import process from 'node:process';

/**
 * All tokens are defined once here so designers and engineers maintain
 * a single canonical palette. If the guide changes, update this object
 * and re-run the script; every downstream check consumes these entries.
 */
const palette = {
  light: {
    'brand.primary.050': '#EEF2FF',
    'brand.primary.200': '#C7D2FE',
    'brand.primary.500': '#4F46E5',
    'brand.primary.600': '#4338CA',
    'brand.primary.700': '#312E81',
    'brand.accent.050': '#ECFEFF',
    'brand.accent.200': '#A5F3FC',
    'brand.accent.500': '#14B8A6',
    'brand.accent.700': '#0F766E',
    'brand.neutral.0': '#FFFFFF',
    'brand.neutral.050': '#F9FAFB',
    'brand.neutral.200': '#E5E7EB',
    'brand.neutral.500': '#6B7280',
    'brand.neutral.700': '#374151',
    'brand.neutral.900': '#111827',
    'brand.warning.050': '#FFF7ED',
    'brand.warning.500': '#F97316',
    'brand.warning.700': '#B45309',
    'brand.critical.050': '#FEF2F2',
    'brand.critical.500': '#DC2626',
    'brand.critical.700': '#991B1B',
  },
  dark: {
    'brand.primary.200': '#C7D2FE',
    'brand.primary.300': '#A5B4FC',
    'brand.primary.400': '#818CF8',
    'brand.primary.900': '#1E1B4B',
    'brand.primary.950': '#11123A',
    'brand.accent.200': '#99F6E4',
    'brand.accent.400': '#2DD4BF',
    'brand.accent.700': '#0B5F59',
    'brand.accent.950': '#042F2E',
    'brand.neutral.050': '#F9FAFB',
    'brand.neutral.500': '#6B7280',
    'brand.neutral.700': '#374151',
    'brand.neutral.900': '#111827',
    'brand.neutral.950': '#030712',
    'brand.warning.200': '#FED7AA',
    'brand.warning.400': '#FB923C',
    'brand.warning.900': '#7C2D12',
    'brand.critical.200': '#FECACA',
    'brand.critical.400': '#F87171',
    'brand.critical.900': '#7F1D1D',
  },
};

/**
 * Utility: convert a hex string (e.g. #4F46E5) into an RGB tuple between 0-1.
 * WCAG expects sRGB values linearized into the 0-1 range before applying
 * luminance weighting.
 */
const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
};

/**
 * Utility: convert sRGB to linear RGB per WCAG. Values <= 0.03928 use a
 * simple division, otherwise apply the exponential curve.
 */
const toLinear = (channel) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/**
 * Relative luminance (Y) calculation using WCAG coefficients.
 */
const relativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/**
 * Contrast ratio between two colors. Always returns the lighter/darker
 * luminance ratio in the WCAG-defined format.
 */
const contrastRatio = (foreground, background) => {
  const lumA = relativeLuminance(foreground);
  const lumB = relativeLuminance(background);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Pairings sourced from the style guide. Each pairing references the token
 * keys above to keep everything traceable. Adjust `minRatio` according to
 * WCAG 2.2 AA requirements: 4.5 for standard text, 3.0 for large (>=18pt or
 * bold 14pt), and 3.0 for non-text essential UI elements.
 */
const pairings = [
  {
    id: 'body-light',
    foreground: 'brand.neutral.900',
    background: 'brand.neutral.0',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Body copy on white cards',
  },
  {
    id: 'secondary-text-light',
    foreground: 'brand.neutral.700',
    background: 'brand.neutral.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Secondary text on cards',
  },
  {
    id: 'primary-button-light',
    foreground: 'brand.neutral.0',
    background: 'brand.primary.500',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Primary button text',
  },
  {
    id: 'primary-button-container-light',
    foreground: 'brand.primary.600',
    background: 'brand.neutral.050',
    mode: 'light',
    minRatio: 3.0,
    notes: 'Filled button vs light background',
  },
  {
    id: 'secondary-button-light',
    foreground: 'brand.primary.600',
    background: 'brand.primary.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Secondary button text',
  },
  {
    id: 'destructive-light',
    foreground: 'brand.neutral.0',
    background: 'brand.critical.500',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Destructive button text',
  },
  {
    id: 'success-alert-light',
    foreground: 'brand.accent.700',
    background: 'brand.accent.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Success alert text',
  },
  {
    id: 'warning-alert-light',
    foreground: 'brand.warning.700',
    background: 'brand.warning.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Warning banner text',
  },
  {
    id: 'critical-alert-light',
    foreground: 'brand.critical.700',
    background: 'brand.critical.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Critical banner text',
  },
  {
    id: 'body-dark',
    foreground: 'brand.neutral.050',
    background: 'brand.neutral.950',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Body copy on dark surfaces',
  },
  {
    id: 'secondary-text-dark',
    foreground: 'brand.neutral.050',
    background: 'brand.neutral.900',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Secondary text in dark UI',
  },
  {
    id: 'primary-button-dark',
    foreground: 'brand.neutral.950',
    background: 'brand.primary.300',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Primary button text in dark mode',
  },
  {
    id: 'primary-button-container-dark',
    foreground: 'brand.primary.200',
    background: 'brand.primary.950',
    mode: 'dark',
    minRatio: 3.0,
    notes: 'Filled button vs dark background',
  },
  {
    id: 'secondary-button-dark',
    foreground: 'brand.primary.200',
    background: 'brand.primary.950',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Secondary button text in dark mode',
  },
  {
    id: 'destructive-dark',
    foreground: 'brand.neutral.950',
    background: 'brand.critical.400',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Destructive button text in dark mode',
  },
  {
    id: 'success-alert-dark',
    foreground: 'brand.accent.200',
    background: 'brand.accent.950',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Success alert text dark theme',
  },
  {
    id: 'warning-alert-dark',
    foreground: 'brand.warning.200',
    background: 'brand.warning.900',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Warning banner text dark theme',
  },
  {
    id: 'critical-alert-dark',
    foreground: 'brand.critical.200',
    background: 'brand.critical.900',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Critical banner text dark theme',
  },
  {
    id: 'accent-on-surface-dark',
    foreground: 'brand.accent.200',
    background: 'brand.neutral.900',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Success iconography on card',
  },
  {
    id: 'matrix-accent',
    foreground: 'brand.accent.200',
    background: 'brand.accent.950',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Matrix pairing — success text',
  },
  {
    id: 'matrix-primary',
    foreground: 'brand.primary.200',
    background: 'brand.primary.950',
    mode: 'dark',
    minRatio: 4.5,
    notes: 'Matrix pairing — primary text on surface',
  },
  {
    id: 'matrix-warning',
    foreground: 'brand.warning.700',
    background: 'brand.warning.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Matrix pairing — warning badge',
  },
  {
    id: 'matrix-inverted',
    foreground: 'brand.neutral.0',
    background: 'brand.primary.500',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Matrix pairing — inverted button',
  },
  {
    id: 'matrix-light-surface',
    foreground: 'brand.primary.600',
    background: 'brand.neutral.050',
    mode: 'light',
    minRatio: 4.5,
    notes: 'Matrix pairing — primary on light surface',
  },
];

const failures = [];

for (const pairing of pairings) {
  const paletteForMode = palette[pairing.mode];
  const fgHex = paletteForMode?.[pairing.foreground];
  const bgHex = paletteForMode?.[pairing.background];
  if (!fgHex || !bgHex) {
    failures.push({
      id: pairing.id,
      message: `Missing token definition for ${!fgHex ? pairing.foreground : pairing.background} in mode ${pairing.mode}.`,
    });
    continue;
  }
  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio < pairing.minRatio) {
    failures.push({
      id: pairing.id,
      message: `${pairing.id} failed: ratio ${ratio.toFixed(2)} < required ${pairing.minRatio.toFixed(2)} (${pairing.notes}).`,
    });
  } else {
    console.log(
      `✅  ${pairing.id.padEnd(28)} ${ratio.toFixed(2)}:1 passes (>= ${pairing.minRatio.toFixed(2)})`,
    );
  }
}

if (failures.length > 0) {
  console.error('\n❌ Contrast audit failed. Resolve the issues above before shipping.');
  for (const failure of failures) {
    console.error(`   - ${failure.message}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n✅ All documented palette combinations meet WCAG 2.2 AA thresholds.');
}
