import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';

import MobileNavigationDrawer from '../MobileNavigationDrawer';

import type { NavigationMenuGroup } from '../RadixNavigationMenu';

const sampleGroups: ReadonlyArray<NavigationMenuGroup> = [
  {
    label: 'Alpha',
    description: 'First synthetic grouping for verification.',
    links: [
      { label: 'One', href: '/one', description: 'Example link one.' },
      { label: 'Two', href: '/two', description: 'Example link two.' },
    ],
  },
];

describe('MobileNavigationDrawer', () => {
  it('wires aria-controls/aria-expanded to the Radix dialog content', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(<MobileNavigationDrawer groups={sampleGroups} />);

    const [trigger] = screen.getAllByRole('button', { name: /navigation menu/i, hidden: true });
    const controlledId = trigger.getAttribute('aria-controls');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(controlledId).toBeTruthy();

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(controlledId).toBe(trigger.getAttribute('aria-controls'));

    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(dialog).toBeDefined();
    expect(screen.getByRole('link', { name: 'One Example link one.' })).toBeDefined();
    await user.keyboard('{Escape}');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('exposes skip links to accelerate keyboard traversal', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(<MobileNavigationDrawer groups={sampleGroups} />);

    const [trigger] = screen.getAllByRole('button', { name: /navigation menu/i, hidden: true });
    await user.click(trigger);

    const skipToContent = screen.getByRole('link', { name: 'Skip to page content' });
    const skipToNav = screen.getByRole('link', { name: 'Skip to navigation links' });

    expect(skipToContent.getAttribute('href')).toBe('#main');
    expect(skipToNav.getAttribute('href')).toContain('list');
    await waitFor(() => {
      expect(document.activeElement).toBe(skipToNav);
    });
  });
});
