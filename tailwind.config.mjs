/** @type {import('tailwindcss').Config} */
const config = {
  content: ['src/**/*.{astro,html,md,mdx,js,jsx,ts,tsx}'],
  theme: {
    extend: {
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
