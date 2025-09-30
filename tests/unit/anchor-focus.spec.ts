import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

import {
  focusElementAfterScroll,
  getPreferredScrollBehavior,
  installAnchorFocusManager,
  resolveAnchorTargetId,
} from '../../src/utils/accessibility/anchorFocus';

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

describe('getPreferredScrollBehavior', () => {
  test('returns smooth when reduced motion is not requested', () => {
    expect(getPreferredScrollBehavior(createMediaQueryList(false))).toBe('smooth');
  });

  test('returns auto when reduced motion is requested', () => {
    expect(getPreferredScrollBehavior(createMediaQueryList(true))).toBe('auto');
  });
});

describe('focusElementAfterScroll', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('defers focus until the smooth scrolling delay elapses', () => {
    vi.useFakeTimers();
    const target = document.createElement('section');
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    target.scrollIntoView = scrollSpy as typeof target.scrollIntoView;
    target.focus = focusSpy as unknown as typeof target.focus;

    focusElementAfterScroll(target, { behavior: 'smooth', smoothDelayMs: 20 });

    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
    expect(focusSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  test('focuses immediately when smooth scrolling is disabled', () => {
    const target = document.createElement('section');
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    target.scrollIntoView = scrollSpy as typeof target.scrollIntoView;
    target.focus = focusSpy as unknown as typeof target.focus;

    const timer = focusElementAfterScroll(target, { behavior: 'auto' });

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start', inline: 'nearest' });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(timer).toBeNull();
  });
});

describe('resolveAnchorTargetId', () => {
  test('prefers the explicit data attribute when present', () => {
    const anchor = document.createElement('a');
    anchor.dataset.skipLinkTarget = 'main';
    anchor.href = '#ignored';

    expect(resolveAnchorTargetId(anchor)).toBe('main');
  });

  test('derives the ID from the hash when no data attribute exists', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#analytics');

    expect(resolveAnchorTargetId(anchor)).toBe('analytics');
  });
});

describe('installAnchorFocusManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('scrolls and focuses the associated landmark', () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <a data-skip-link href="#main">Skip</a>
      <main id="main" tabindex="-1"></main>
    `;

    const anchor = document.querySelector('a')!;
    const main = document.getElementById('main')!;

    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    const replaceSpy = vi.spyOn(history, 'replaceState');

    main.scrollIntoView = scrollSpy as typeof main.scrollIntoView;
    main.focus = focusSpy as unknown as typeof main.focus;

    installAnchorFocusManager({
      anchorSelector: '[data-skip-link]',
      motionQuery: createMediaQueryList(false),
      smoothDelayMs: 0,
    });

    anchor.click();

    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(replaceSpy).toHaveBeenCalledWith(history.state, '', '#main');
    replaceSpy.mockRestore();
  });

  test('logs a configuration error when the target cannot be located', () => {
    const errorSpy = vi.fn();

    document.body.innerHTML = `<a data-skip-link href="#missing">Broken</a>`;

    installAnchorFocusManager({
      anchorSelector: '[data-skip-link]',
      logger: { error: errorSpy, warn: vi.fn() },
    });

    expect(errorSpy).toHaveBeenCalled();
  });
});
