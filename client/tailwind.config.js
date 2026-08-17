/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: 'rgb(var(--color-charcoal) / <alpha-value>)',
        gold: 'rgb(var(--color-gold) / <alpha-value>)',
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        copper: 'rgb(var(--color-copper) / <alpha-value>)',
        taupe: 'rgb(var(--color-taupe) / <alpha-value>)',
        ivory: 'rgb(var(--color-ivory) / <alpha-value>)',
        'logo-bar': 'rgb(var(--color-logo-bar) / <alpha-value>)',
        ink: 'rgb(var(--color-charcoal) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Noto Naskh Arabic"', 'serif'],
        sans: ['Manrope', '"Noto Sans Arabic"', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
    },
  },
  plugins: [],
};
