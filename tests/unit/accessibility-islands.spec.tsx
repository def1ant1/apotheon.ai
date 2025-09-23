import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';

import ContactForm from '../../src/components/islands/ContactForm';
import MobileNavigationDrawer from '../../src/components/islands/MobileNavigationDrawer';
import RadixNavigationMenu from '../../src/components/islands/RadixNavigationMenu';

describe('island accessibility contracts', () => {
  it('RadixNavigationMenu exposes a named navigation landmark', () => {
    render(<RadixNavigationMenu />);

    const navigation = screen.getByRole('navigation', { name: /primary/i });
    expect(navigation).toBeInTheDocument();
  });

  it('MobileNavigationDrawer wires aria-controls and skip links', async () => {
    const user = userEvent.setup();
    render(<MobileNavigationDrawer />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    const controlsId = trigger.getAttribute('aria-controls');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(controlsId).toBeTruthy();

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /mobile navigation/i });
    expect(dialog).toHaveAttribute('id', controlsId ?? undefined);

    const skipLink = screen.getByRole('link', { name: /Skip to navigation links/i });
    expect(skipLink).toBeInTheDocument();
  });

  it('ContactForm surfaces validation messaging through the status region', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-describedby', 'contact-form-status');
    const labelledBy = form.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const legend = labelledBy ? document.getElementById(labelledBy) : null;
    expect(legend?.tagName.toLowerCase()).toBe('legend');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('id', 'contact-form-status');
    expect(status).toHaveTextContent(/Complete the verification challenge/i);
    expect(submitButton).toHaveAttribute('aria-live', 'polite');
  });
});
