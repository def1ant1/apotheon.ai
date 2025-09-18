/** @type {import('tailwindcss').Config} */
const config = {
  content: ['src/**/*.{astro,html,md,mdx,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'var(--font-family-sans)', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
