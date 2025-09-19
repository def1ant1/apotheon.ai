import { ThemeState, type StoryDecorator } from '@ladle/react';
import { useMemo } from 'react';
import '../src/styles/global.css';

/**
 * Global decorators make every story render inside the same theming + typography context as the
 * Astro app. Instead of copy/pasting CSS imports across stories we centralize the behavior here
 * and keep it TypeScript-aware so large teams inherit the same guardrails.
 */
export const decorators: StoryDecorator[] = [
  (Story, context) => {
    /**
     * Translate Ladle's theme toggle (light/dark/auto) into the `data-theme` contract consumed by
     * our CSS variables. When reviewers pick "auto" we intentionally leave the attribute off so
     * `prefers-color-scheme` can drive the appearance just like production.
     */
    const themeAttribute = useMemo(() => {
      if (context.globalState.theme === ThemeState.Dark) {
        return { 'data-theme': ThemeState.Dark } as const;
      }

      if (context.globalState.theme === ThemeState.Light) {
        return { 'data-theme': ThemeState.Light } as const;
      }

      return {};
    }, [context.globalState.theme]);

    return (
      <div
        {...themeAttribute}
        className="ladle-story-wrapper"
        style={{
          minHeight: '100vh',
          background: 'var(--color-surface-base)',
          color: 'var(--color-ink-primary)',
          padding: 'var(--space-lg)',
          fontFamily: 'var(--font-family-base, Inter, system-ui, sans-serif)',
        }}
      >
        <Story />
      </div>
    );
  },
];
