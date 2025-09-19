/** @type {import('tailwindcss').Config} */
const config = {
  content: ['src/**/*.{astro,html,md,mdx,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
          Radix-driven components centralize around a "brand" accent so the interaction
          shell stays consistent across islands and Astro templates. By registering
          semantic tokens (rather than hex values sprinkled through JSX) we make it
          trivial to retheme via Tailwind without hunting for magic numbers.
        */
        brand: {
          primary: '#4c6ef5',
          secondary: '#15aabf'
        }
      },
      boxShadow: {
        /* Soft ambient glow for floating panels such as the Radix navigation viewport. */
        navigation: '0 25px 50px -20px rgba(8, 15, 34, 0.6)',
        /* Inset accent outline used on hover/focus for navigation links. */
        'navigation-inset': 'inset 0 0 0 1px rgba(76, 110, 245, 0.35)'
      },
      fontFamily: {
        /*
          Prioritize the self-hosted Inter Variable font injected via
          src/styles/global.css. Keeping the legacy CSS custom property and
          system fallbacks ensures we degrade gracefully even if the local font
          bundle is unavailable for some reason.
        */
        sans: [
          'Inter Variable',
          'Inter',
          'var(--font-family-sans)',
          'system-ui',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
};

export default config;
