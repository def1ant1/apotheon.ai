import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
    /**
     * Radix mounts a ResizeObserver when measuring the navigation viewport. jsdom lacks the API, so
     * we polyfill the subset of methods used during tests to keep coverage meaningful.
     */
    const ResizeObserverStub = class {
      observe() {
        return undefined;
      }

      unobserve() {
        return undefined;
      }

      disconnect() {
        return undefined;
      }
    };

    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
      window.ResizeObserver;
  }
});

import ContactForm from '../../src/components/islands/ContactForm';
import MobileNavigationDrawer from '../../src/components/islands/MobileNavigationDrawer';
import RadixNavigationMenu, {
  navigationMenuGroups,
} from '../../src/components/islands/RadixNavigationMenu';
import WhitepaperRequestForm from '../../src/components/islands/WhitepaperRequestForm';

describe('island accessibility contracts', () => {
  it('RadixNavigationMenu exposes a named navigation landmark', () => {
    render(<RadixNavigationMenu />);

    const navigation = screen.getByRole('navigation', { name: /primary/i });
    expect(navigation).toBeDefined();
  });

  it('RadixNavigationMenu surfaces handbook, runbook, and brand kit entry points', () => {
    render(<RadixNavigationMenu />);

    /**
     * Validate that the three new navigation buckets render triggers so keyboard/assistive tech
     * users can reach them without relying on hover interactions.
     */
    expect(screen.getByRole('button', { name: 'Docs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Security Runbooks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Brand Kit' })).toBeInTheDocument();

    const docsGroup = navigationMenuGroups.find((group) => group.id === 'docs');
    const securityGroup = navigationMenuGroups.find((group) => group.id === 'security-runbooks');
    const brandKitGroup = navigationMenuGroups.find((group) => group.id === 'brand-kit');

    expect(docsGroup?.links.map((link) => link.href)).toEqual([
      '/docs/',
      '/docs/architecture/decisions',
      '/docs/content/information-architecture',
    ]);
    expect(securityGroup?.links.map((link) => link.href)).toEqual([
      '/docs/security/runbook-contact-abuse',
      '/docs/security/runbook-csp-triage',
      '/docs/security/runbook-r2-incident',
    ]);
    expect(brandKitGroup?.links.map((link) => link.href)).toEqual([
      '/docs/brand/styleguide',
      '/static/brand/palette-light.svg',
      '/static/brand/typography-scale.svg',
    ]);
  });

  it('MobileNavigationDrawer wires aria-controls and skip links', async () => {
    const user = userEvent.setup();
    render(<MobileNavigationDrawer />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    const controlsId = trigger.getAttribute('aria-controls');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(controlsId).toBeTruthy();

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /mobile navigation/i });
    expect(dialog.getAttribute('id')).toBe(controlsId ?? undefined);

    const skipLink = screen.getByRole('link', { name: /Skip to navigation links/i });
    expect(skipLink).toBeDefined();
  });

  it('ContactForm surfaces validation messaging through the status region', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const form = screen.getByRole('form');
    expect(form.getAttribute('aria-describedby')).toBe('contact-form-status');
    const labelledBy = form.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const legend = labelledBy ? document.getElementById(labelledBy) : null;
    expect(legend?.tagName.toLowerCase()).toBe('legend');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    const status = await screen.findByRole('status');
    expect(status.getAttribute('id')).toBe('contact-form-status');
    expect(status.textContent ?? '').toMatch(/Complete the verification challenge/i);
    expect(submitButton.getAttribute('aria-live')).toBe('polite');
  });

  it('WhitepaperRequestForm announces download readiness and verification issues', async () => {
    const user = userEvent.setup();
    render(<WhitepaperRequestForm />);

    const form = screen.getByRole('form', { name: /whitepaper/i });
    expect(form.getAttribute('aria-describedby')).toBe('whitepaper-form-status');

    const submit = screen.getByRole('button', { name: /request download/i });
    await user.click(submit);

    const status = await screen.findByRole('status');
    expect(status.getAttribute('id')).toBe('whitepaper-form-status');
    expect(status.textContent ?? '').toMatch(/verification/i);
  });
});
