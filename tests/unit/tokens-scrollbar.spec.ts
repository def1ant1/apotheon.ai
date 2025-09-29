import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TOKENS_PATH = resolve(process.cwd(), 'src/styles/tokens.css');

describe('design token scrollbar contract', () => {
  const tokensCss = readFileSync(TOKENS_PATH, 'utf8');
  let styleElement: HTMLStyleElement;

  beforeAll(() => {
    styleElement = document.createElement('style');
    styleElement.textContent = tokensCss;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement.remove();
  });

  it('declares explicit scrollbar variables for documentation parity', () => {
    expect(tokensCss).toContain('--color-scrollbar-track');
    expect(tokensCss).toContain('--color-scrollbar-thumb');
    expect(tokensCss).toContain('--color-scrollbar-thumb-hover');
    expect(tokensCss).toContain('--size-scrollbar-thickness');
    expect(tokensCss).toContain('--scrollbar-width-mode');
  });

  it('resolves scrollbar tokens in light and dark themes', () => {
    document.documentElement.removeAttribute('data-theme');
    const lightStyles = getComputedStyle(document.documentElement);
    expect(lightStyles.getPropertyValue('--color-scrollbar-track').trim()).toBe('219 41% 94%');
    expect(lightStyles.getPropertyValue('--color-scrollbar-thumb').trim()).toBe('221 39% 72%');
    expect(lightStyles.getPropertyValue('--color-scrollbar-thumb-hover').trim()).toBe(
      '227 90% 58%',
    );
    expect(lightStyles.getPropertyValue('--size-scrollbar-thickness').trim()).toBe('0.75rem');
    expect(lightStyles.getPropertyValue('--scrollbar-width-mode').trim()).toBe('thin');

    document.documentElement.setAttribute('data-theme', 'dark');
    const darkStyles = getComputedStyle(document.documentElement);
    expect(darkStyles.getPropertyValue('--color-scrollbar-track').trim()).toBe('223 40% 18%');
    expect(darkStyles.getPropertyValue('--color-scrollbar-thumb').trim()).toBe('223 32% 26%');
    expect(darkStyles.getPropertyValue('--color-scrollbar-thumb-hover').trim()).toBe('226 92% 70%');
    expect(darkStyles.getPropertyValue('--size-scrollbar-thickness').trim()).toBe('0.75rem');
    expect(darkStyles.getPropertyValue('--scrollbar-width-mode').trim()).toBe('thin');

    document.documentElement.removeAttribute('data-theme');
  });
});
