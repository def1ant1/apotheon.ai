import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';

import { localizePath, type Locale } from '../../i18n';
import { isSupportedLocale } from '../../utils/featureFlags';

export type LocaleSwitcherLabels = {
  ariaLabel: string;
  instructions: string;
  statusCurrent: string;
  statusUpdated: string;
  defaultLocaleSuffix: string;
};

type LocaleSwitcherProps = {
  availableLocales: ReadonlyArray<Locale>;
  currentLocale: Locale;
  defaultLocale: Locale;
  labels: LocaleSwitcherLabels;
  pathname: string;
};

const I18NEXT_COOKIE_NAME = 'i18next';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // one calendar year

/**
 * Persist a locale hint for astro-i18next so future requests that land on the root path
 * without an explicit locale segment continue serving the user's chosen language.
 */
const persistLocaleCookie = (locale: Locale) => {
  if (typeof document === 'undefined') {
    return;
  }

  const secureSuffix =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${I18NEXT_COOKIE_NAME}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureSuffix}`;
};

const LOCALE_TEMPLATE_TOKEN = '{{locale}}';

const replaceLocaleToken = (template: string, localizedName: string) =>
  template.replace(LOCALE_TEMPLATE_TOKEN, localizedName);

const DEFAULT_CONTAINER_CLASSES =
  'sr-only focus-within:not-sr-only focus-within:fixed focus-within:right-space-sm focus-within:top-space-sm focus-within:z-50 focus-within:w-80 focus-within:max-w-full focus-within:rounded-lg focus-within:border focus-within:border-ink-faint focus-within:bg-surface-base focus-within:p-space-sm focus-within:shadow-2xl focus-within:outline focus-within:outline-2 focus-within:outline-accent-brand/60';

const SELECT_CLASSES =
  'w-full rounded border border-ink-faint bg-surface-raised px-space-2xs py-space-3xs text-body-sm text-ink-primary shadow-inner focus:border-accent-brand focus:outline-none';

const LABEL_CLASSES = 'text-title-xs font-semibold text-ink-primary';
const INSTRUCTIONS_CLASSES = 'text-caption text-ink-muted';
const STATUS_CLASSES = 'mt-space-3xs text-caption text-ink-primary';

const buildDisplayNames = (currentLocale: Locale, defaultLocale: Locale) => {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return null;
  }

  try {
    return new Intl.DisplayNames([currentLocale, defaultLocale, 'en'], { type: 'language' });
  } catch {
    console.warn(
      '[locale-switcher] Unable to instantiate Intl.DisplayNames. Falling back to locale codes.',
    );
    return null;
  }
};

const formatLocaleName = (
  locale: Locale,
  defaultLocale: Locale,
  displayNames: Intl.DisplayNames | null,
  labels: LocaleSwitcherLabels,
): string => {
  let localizedName: string | undefined;

  if (displayNames) {
    try {
      localizedName = displayNames.of(locale) ?? undefined;
    } catch {
      console.warn('[locale-switcher] Failed to resolve display name for locale', locale);
    }
  }

  const fallback = locale.toUpperCase();
  const resolved = localizedName ?? fallback;

  if (locale === defaultLocale) {
    return `${resolved} (${labels.defaultLocaleSuffix})`;
  }

  return resolved;
};

const LocaleSwitcher = ({
  availableLocales,
  currentLocale,
  defaultLocale,
  labels,
  pathname,
}: LocaleSwitcherProps) => {
  const selectId = useId();
  const instructionsId = `${selectId}-instructions`;
  const statusId = `${selectId}-status`;

  const displayNames = useMemo(
    () => buildDisplayNames(currentLocale, defaultLocale),
    [currentLocale, defaultLocale],
  );

  const resolveLocaleLabel = useCallback(
    (locale: Locale) => formatLocaleName(locale, defaultLocale, displayNames, labels),
    [defaultLocale, displayNames, labels],
  );

  const renderStatusWithLocale = useCallback(
    (template: string, locale: Locale) => replaceLocaleToken(template, resolveLocaleLabel(locale)),
    [resolveLocaleLabel],
  );

  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale);
  const [statusMessage, setStatusMessage] = useState<string>(() =>
    renderStatusWithLocale(labels.statusCurrent, currentLocale),
  );

  useEffect(() => {
    setSelectedLocale(currentLocale);
    setStatusMessage(renderStatusWithLocale(labels.statusCurrent, currentLocale));
  }, [currentLocale, labels.statusCurrent, renderStatusWithLocale]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const candidateLocale = event.target.value;

      if (!isSupportedLocale(candidateLocale, availableLocales)) {
        setStatusMessage(renderStatusWithLocale(labels.statusCurrent, selectedLocale));
        return;
      }

      if (candidateLocale === selectedLocale) {
        setStatusMessage(renderStatusWithLocale(labels.statusCurrent, selectedLocale));
        return;
      }

      setSelectedLocale(candidateLocale);
      setStatusMessage(renderStatusWithLocale(labels.statusUpdated, candidateLocale));

      // astro-i18next ships ESM bundles without typed client helpers, so eslint flags the
      // invocation as `any`. The surrounding guards ensure we only pass supported locales.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const nextPathname = localizePath(pathname, candidateLocale);
      persistLocaleCookie(candidateLocale);

      if (typeof window !== 'undefined') {
        const { search, hash } = window.location;
        window.location.assign(`${nextPathname}${search}${hash}`);
      }
    },
    [
      availableLocales,
      labels.statusCurrent,
      labels.statusUpdated,
      pathname,
      renderStatusWithLocale,
      selectedLocale,
    ],
  );

  return (
    <div className={DEFAULT_CONTAINER_CLASSES}>
      <label className={LABEL_CLASSES} htmlFor={selectId} id={`${selectId}-label`}>
        {labels.ariaLabel}
      </label>
      <p id={instructionsId} className={INSTRUCTIONS_CLASSES}>
        {labels.instructions}
      </p>
      <select
        aria-describedby={`${instructionsId} ${statusId}`}
        className={SELECT_CLASSES}
        id={selectId}
        name="qa-locale-switcher"
        onChange={handleChange}
        value={selectedLocale}
      >
        {availableLocales.map((locale) => (
          <option key={locale} value={locale}>
            {resolveLocaleLabel(locale)}
          </option>
        ))}
      </select>
      <p
        aria-live="polite"
        aria-atomic="true"
        className={STATUS_CLASSES}
        id={statusId}
        role="status"
      >
        {statusMessage}
      </p>
    </div>
  );
};

export default LocaleSwitcher;
