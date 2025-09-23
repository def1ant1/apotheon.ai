import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { useEffect } from 'react';
import { useCallback, useId, useMemo, useRef, useState, type MouseEvent } from 'react';

import { navigationMenuGroups, type NavigationMenuGroup } from './RadixNavigationMenu';

export interface MobileNavigationDrawerProps {
  readonly groups?: ReadonlyArray<NavigationMenuGroup>;
}

export default function MobileNavigationDrawer({
  groups = navigationMenuGroups,
}: MobileNavigationDrawerProps = {}) {
  /**
   * Memoizing the group collection avoids unnecessary re-renders when the parent island keeps the
   * same reference between hydration passes. We intentionally allow consumers to inject sanitized
   * data so both desktop and mobile shells can stay in lockstep without duplicating arrays.
   */
  const menuGroups = useMemo(() => groups, [groups]);

  /**
   * `useId` provides deterministic identifiers that remain stable during SSR and client hydration.
   * The toggle button wires `aria-controls` to the dialog content so assistive tech understands the
   * relationship, while the list id powers our skip link target.
   */
  const navigationContentId = useId();
  const navigationListId = `${navigationContentId}-list`;
  /**
   * Stash refs for skip links and the trigger so we can steer focus intentionally. Radix handles
   * most focus management, but nudging the first tabbable element to the skip link reinforces that
   * keyboard users land on a predictable control when the drawer opens.
   */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const skipLinkRef = useRef<HTMLAnchorElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    host.setAttribute('data-mobile-nav-ready', 'true');
    return () => {
      host.setAttribute('data-mobile-nav-ready', 'false');
    };
  }, []);

  const [open, setOpen] = useState(false);

  /**
   * Radix exposes the open state via a controlled API. We keep a local mirror to toggle
   * `aria-expanded` on the trigger, which keeps VoiceOver/NVDA narrations accurate.
   */
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  /**
   * When the dialog opens we short-circuit Radix's default focus (which would land on the content
   * element) so that keyboard users discover the skip links immediately.
   */
  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    requestAnimationFrame(() => {
      skipLinkRef.current?.focus();
    });
  }, []);

  /**
   * Returning focus manually avoids race conditions if future contributors wrap the trigger in
   * additional DOM. It also doubles as an assertion target for our accessibility regression tests.
   */
  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  /**
   * Radix already closes the dialog when users click the overlay, but mirroring the behaviour lets
   * us keep the state hook in sync and prevents stale `aria-expanded` values if another consumer
   * decides to control the component imperatively.
   */
  const handleOverlayClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setOpen(false);
    }
  }, []);

  return (
    <div className="contents" ref={hostRef} data-mobile-nav-ready="false">
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            ref={triggerRef}
            className="flex items-center gap-space-2xs rounded-radius-md border border-border-subtle bg-surface-raised px-space-sm py-space-2xs text-body-sm font-semibold text-ink-primary shadow-elevation-1 transition hover:bg-surface-raised/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            aria-expanded={open}
            aria-controls={navigationContentId}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span aria-hidden className="text-caption uppercase tracking-wide text-ink-muted">
              Menu
            </span>
            <VisuallyHidden>{open ? 'Close navigation' : 'Open navigation'}</VisuallyHidden>
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          {/**
           * The overlay doubles as both a visual scrim and an accessible escape hatch. Screen reader
           * users land on the link immediately and can return to the underlying page without hunting
           * for the close button.
           */}
          <Dialog.Overlay
            className="fixed inset-0 z-[60] bg-utility-backdrop/60 backdrop-blur-sm"
            onClick={handleOverlayClick}
          >
            <Dialog.Close asChild>
              <a
                href="#main"
                className="sr-only absolute left-1/2 top-6 -translate-x-1/2 rounded-radius-pill bg-surface-base/95 px-space-sm py-space-2xs text-body-sm font-medium text-ink-primary shadow-elevation-2 focus:not-sr-only"
              >
                Skip overlay and return to page content
              </a>
            </Dialog.Close>
          </Dialog.Overlay>

          <Dialog.Content
            id={navigationContentId}
            aria-describedby={`${navigationContentId}-description`}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xs flex-col overflow-y-auto border-l border-border-subtle bg-surface-base px-6 pb-8 pt-6 shadow-2xl outline-none sm:max-w-sm"
            onOpenAutoFocus={handleOpenAutoFocus}
            onCloseAutoFocus={handleCloseAutoFocus}
          >
            <Dialog.Title className="text-title-sm font-semibold text-ink-primary">
              Mobile navigation
            </Dialog.Title>
            <Dialog.Description
              id={`${navigationContentId}-description`}
              className="mt-1 text-body-sm text-ink-muted"
            >
              Primary Apotheon.ai sections reproduced for small screens.
            </Dialog.Description>

            <div className="mt-4 flex flex-col gap-space-2xs">
              <Dialog.Close asChild>
                <a
                  href="#main"
                  className="sr-only inline-flex w-max items-center gap-space-2xs rounded-radius-md bg-accent-brand px-space-sm py-space-2xs text-body-sm font-semibold text-ink-inverted shadow-elevation-2 focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  Skip to page content
                </a>
              </Dialog.Close>
              <a
                ref={skipLinkRef}
                href={`#${navigationListId}`}
                className="sr-only inline-flex w-max items-center gap-space-2xs rounded-radius-md bg-surface-raised/80 px-space-sm py-space-2xs text-body-sm font-semibold text-ink-primary shadow-elevation-1 focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                Skip to navigation links
              </a>
            </div>

            {/**
             * Instead of freehanding JSX per group, we iterate over the shared navigation config so
             * both desktop and mobile shells remain perfectly synchronized. This guardrails future
             * additions by forcing teams to extend the canonical data export first.
             */}
            <nav aria-label="Primary" className="mt-6">
              <ul id={navigationListId} className="flex flex-col gap-space-sm">
                {menuGroups.map((group) => (
                  <li key={group.label} className="flex flex-col gap-space-2xs">
                    <div className="flex flex-col gap-space-3xs">
                      <p className="text-title-sm font-semibold text-ink-primary">{group.label}</p>
                      <p className="text-body-sm text-ink-muted">{group.description}</p>
                    </div>

                    <ul className="flex flex-col gap-space-3xs border-l border-dashed border-border-subtle/60 pl-space-sm">
                      {group.links.map((link) => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="block rounded-radius-md px-space-sm py-space-2xs text-body-sm font-medium text-ink-primary transition hover:bg-surface-raised/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                          >
                            <span className="block">{link.label}</span>
                            <span className="block text-caption text-ink-muted">
                              {link.description}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>

            <Dialog.Close asChild>
              <button
                type="button"
                className="mt-8 rounded-radius-md border border-border-subtle px-space-sm py-space-2xs text-body-sm font-semibold text-ink-primary transition hover:bg-surface-raised/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                Close menu
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
