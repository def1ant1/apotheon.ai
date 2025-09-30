import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { useEffect } from 'react';
import { useCallback, useId, useMemo, useRef, useState, type MouseEvent } from 'react';

import PagefindSearch from './PagefindSearch';
import { navigationMenuGroups, type NavigationMenuGroup } from './RadixNavigationMenu';
import { PREFETCH_ATTRIBUTE_PAYLOAD } from '../../utils/navigation/prefetch-constants';

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
            className="gap-space-2xs rounded-radius-md border-border-subtle bg-surface-raised px-space-sm py-space-2xs text-body-sm text-ink-primary shadow-elevation-1 hover:bg-surface-raised/90 focus-visible:outline-accent-brand flex items-center border font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-expanded={open}
            aria-controls={navigationContentId}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span aria-hidden className="text-caption text-ink-muted tracking-wide uppercase">
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
            className="bg-utility-backdrop/60 fixed inset-0 z-[60] backdrop-blur-sm"
            onClick={handleOverlayClick}
          >
            <Dialog.Close asChild>
              <a
                href="#main"
                className="rounded-radius-pill bg-surface-base/95 px-space-sm py-space-2xs text-body-sm text-ink-primary shadow-elevation-2 sr-only absolute top-6 left-1/2 -translate-x-1/2 font-medium focus:not-sr-only"
              >
                Skip overlay and return to page content
              </a>
            </Dialog.Close>
          </Dialog.Overlay>

          <Dialog.Content
            id={navigationContentId}
            aria-describedby={`${navigationContentId}-description`}
            className="border-border-subtle bg-surface-base fixed inset-y-0 right-0 z-[70] flex w-full max-w-xs flex-col overflow-y-auto border-l px-6 pt-6 pb-8 shadow-2xl outline-none sm:max-w-sm"
            onOpenAutoFocus={handleOpenAutoFocus}
            onCloseAutoFocus={handleCloseAutoFocus}
          >
            <Dialog.Title className="text-title-sm text-ink-primary font-semibold">
              Mobile navigation
            </Dialog.Title>
            <Dialog.Description
              id={`${navigationContentId}-description`}
              className="text-body-sm text-ink-muted mt-1"
            >
              Primary Apotheon.ai sections reproduced for small screens.
            </Dialog.Description>

            <div className="gap-space-2xs mt-4 flex flex-col">
              <Dialog.Close asChild>
                <a
                  href="#main"
                  className="gap-space-2xs rounded-radius-md bg-accent-brand px-space-sm py-space-2xs text-body-sm text-ink-inverted shadow-elevation-2 focus-visible:outline-accent-brand sr-only inline-flex w-max items-center font-semibold focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Skip to page content
                </a>
              </Dialog.Close>
              <a
                ref={skipLinkRef}
                href={`#${navigationListId}`}
                className="gap-space-2xs rounded-radius-md bg-surface-raised/80 px-space-sm py-space-2xs text-body-sm text-ink-primary shadow-elevation-1 focus-visible:outline-accent-brand sr-only inline-flex w-max items-center font-semibold focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Skip to navigation links
              </a>
            </div>

            {/**
             * Mobile surfaces inherit the same search affordance as desktop. Because Pagefind streams hits
             * incrementally, focus never jumps when additional results resolve—tab order flows from the input
             * directly into the rendered list. The drawer keeps search above the primary nav so handheld users
             * can reach it without wading through every section link.
             */}
            <div className="border-border-subtle/80 mt-6 border-t pt-6">
              <PagefindSearch />
            </div>

            {/**
             * Instead of freehanding JSX per group, we iterate over the shared navigation config so
             * both desktop and mobile shells remain perfectly synchronized. This guardrails future
             * additions by forcing teams to extend the canonical data export first.
             */}
            <nav aria-label="Primary" className="mt-6">
              <ul id={navigationListId} className="gap-space-sm flex flex-col">
                {menuGroups.map((group) => (
                  <li key={group.label} className="gap-space-2xs flex flex-col">
                    <div className="gap-space-3xs flex flex-col">
                      <p className="text-title-sm text-ink-primary font-semibold">{group.label}</p>
                      <p className="text-body-sm text-ink-muted">{group.description}</p>
                    </div>

                    <ul className="gap-space-3xs border-border-subtle/60 pl-space-sm flex flex-col border-l border-dashed">
                      {group.links.map((link) => (
                        <li key={link.label}>
                          {/* Annotate first-party anchors with the shared prefetch payload so the controller can register them automatically. */}
                          <a
                            {...PREFETCH_ATTRIBUTE_PAYLOAD}
                            href={link.href}
                            className="rounded-radius-md px-space-sm py-space-2xs text-body-sm text-ink-primary hover:bg-surface-raised/70 focus-visible:outline-accent-brand block font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <span className="block">{link.label}</span>
                            <span className="text-caption text-ink-muted block">
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
                className="rounded-radius-md border-border-subtle px-space-sm py-space-2xs text-body-sm text-ink-primary hover:bg-surface-raised/70 focus-visible:outline-accent-brand mt-8 border font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
