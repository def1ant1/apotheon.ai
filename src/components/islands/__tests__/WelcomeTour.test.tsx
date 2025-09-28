import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WelcomeTour, { type WelcomeTourLabels, type WelcomeTourStep } from '../WelcomeTour';
import { WELCOME_TOUR_EVENT_CHANNEL, WELCOME_TOUR_STORAGE_KEY } from '../welcomeTour.constants';

/**
 * Utilities
 * ---------
 * These helpers register DOM nodes that mimic the real homepage landmarks.
 * The component queries by `[data-welcome-tour-target]`, so we replicate those
 * attributes here and stub `getBoundingClientRect` to provide deterministic
 * viewport coordinates inside jsdom.
 */
function registerTarget(
  target: string,
  dimensions: { top: number; left: number; width: number; height: number },
) {
  const node = document.createElement('div');
  node.dataset.welcomeTourTarget = target;
  Object.defineProperty(node, 'getBoundingClientRect', {
    value: () =>
      ({
        top: dimensions.top,
        left: dimensions.left,
        width: dimensions.width,
        height: dimensions.height,
        bottom: dimensions.top + dimensions.height,
        right: dimensions.left + dimensions.width,
        x: dimensions.left,
        y: dimensions.top,
        toJSON() {
          return this;
        },
      }) as DOMRect,
  });
  Object.defineProperty(node, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
  });
  document.body.appendChild(node);
  return node;
}

const baseLabels: WelcomeTourLabels = {
  close: 'Close tour',
  next: 'Next',
  previous: 'Back',
  skip: 'Skip',
  finish: 'Finish',
  progress: 'Step {{current}} of {{total}}',
  srLandmarkPrefix: 'Highlighting',
  srDialogAnnouncement: 'Welcome tour open',
};

const baseSteps: WelcomeTourStep[] = [
  {
    id: 'navigation',
    targetSelector: '[data-welcome-tour-target="primary-navigation"]',
    title: 'Primary navigation',
    description: 'Navigation description',
  },
  {
    id: 'search',
    targetSelector: '[data-welcome-tour-target="global-search"]',
    title: 'Federated search',
    description: 'Search description',
  },
  {
    id: 'docs',
    targetSelector: '[data-welcome-tour-target="docs-hub"]',
    title: 'Documentation launchpad',
    description: 'Docs description',
  },
];

const matchMediaMock = (): MediaQueryList =>
  ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  }) as unknown as MediaQueryList;

describe('WelcomeTour', () => {
  const registeredNodes: HTMLElement[] = [];

  beforeEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
    registeredNodes.splice(0, registeredNodes.length);
    (window as typeof window & { matchMedia?: typeof window.matchMedia }).matchMedia = vi
      .fn()
      .mockImplementation(matchMediaMock);
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
  });

  afterEach(() => {
    registeredNodes.forEach((node) => {
      node.remove();
    });
    delete (window as { dataLayer?: unknown[] }).dataLayer;
  });

  it('opens on first visit, highlights each step, and emits analytics events', async () => {
    registeredNodes.push(
      registerTarget('primary-navigation', { top: 20, left: 20, width: 200, height: 60 }),
    );
    registeredNodes.push(
      registerTarget('global-search', { top: 120, left: 20, width: 200, height: 48 }),
    );
    registeredNodes.push(
      registerTarget('docs-hub', { top: 220, left: 20, width: 200, height: 40 }),
    );

    const capturedEvents: unknown[] = [];
    const listener = (event: Event) => {
      if ('detail' in event) {
        capturedEvents.push((event as CustomEvent).detail);
      }
    };
    window.addEventListener(WELCOME_TOUR_EVENT_CHANNEL, listener);

    const user = userEvent.setup();
    render(
      <WelcomeTour
        title="Welcome"
        description="Guided orientation"
        steps={baseSteps}
        labels={baseLabels}
        dataLayerEventName="test_welcome_tour"
      />,
    );

    const dialog = await screen.findByTestId('welcome-tour-dialog');
    expect(dialog).toBeVisible();
    expect(screen.getByText('Primary navigation')).toBeVisible();

    await user.click(screen.getByTestId('welcome-tour-next'));
    await waitFor(() => expect(screen.getByText('Federated search')).toBeVisible());

    await user.click(screen.getByTestId('welcome-tour-next'));
    await waitFor(() => expect(screen.getByText('Documentation launchpad')).toBeVisible());

    await user.click(screen.getByTestId('welcome-tour-next'));
    await waitFor(() =>
      expect(screen.queryByTestId('welcome-tour-dialog')).not.toBeInTheDocument(),
    );

    window.removeEventListener(WELCOME_TOUR_EVENT_CHANNEL, listener);

    expect(capturedEvents.some((event) => (event as { type?: string }).type === 'open')).toBe(true);
    expect(capturedEvents.some((event) => (event as { type?: string }).type === 'step:next')).toBe(
      true,
    );
    expect(capturedEvents.some((event) => (event as { type?: string }).type === 'complete')).toBe(
      true,
    );

    const dataLayer =
      (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [];
    expect(dataLayer.length).toBeGreaterThan(0);
  });

  it('persists dismissal when skipped', async () => {
    registeredNodes.push(
      registerTarget('primary-navigation', { top: 20, left: 20, width: 200, height: 60 }),
    );

    const user = userEvent.setup();
    render(
      <WelcomeTour
        title="Welcome"
        description="Guided orientation"
        steps={[baseSteps[0]]}
        labels={baseLabels}
      />,
    );

    await user.click(await screen.findByTestId('welcome-tour-skip'));

    await waitFor(() =>
      expect(screen.queryByTestId('welcome-tour-dialog')).not.toBeInTheDocument(),
    );

    const stored = window.localStorage.getItem(WELCOME_TOUR_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(stored ? JSON.parse(stored).status : null).toBe('dismissed');
  });

  it('respects persisted dismissal and stays closed on subsequent renders', async () => {
    window.localStorage.setItem(
      WELCOME_TOUR_STORAGE_KEY,
      JSON.stringify({ status: 'dismissed', timestamp: Date.now() }),
    );

    render(
      <WelcomeTour
        title="Welcome"
        description="Guided orientation"
        steps={baseSteps}
        labels={baseLabels}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('welcome-tour-dialog')).toBeNull();
    });
  });
});
