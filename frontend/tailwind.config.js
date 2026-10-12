/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Josefin Sans"', '"Inter Variable"', 'system-ui', 'sans-serif'], caslon: ['"Libre Caslon Condensed"', '"Josefin Sans"', 'serif'] },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        sub: 'rgb(var(--sub) / <alpha-value>)',
        mute: 'rgb(var(--mute) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .06), 0 8px 24px -12px rgb(var(--shadow) / .12)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        rise: {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'none' },
        },
      },
      animation: { shimmer: 'shimmer 1.4s infinite', rise: 'rise .25s ease-out both' },
    },
  },
  plugins: [],
};
