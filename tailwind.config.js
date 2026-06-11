/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    // Terminal aesthetic: sharp corners everywhere except pills/dots
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      full: '9999px',
    },
    extend: {
      colors: {
        // RGB channel variables — opacity modifiers (bg-surface/50) work correctly
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        // Night-cyan terminal palette (Tokyo Night derived)
        accent: '#22d3ee',
        success: '#9ece6a',
        warning: '#e0af68',
        danger: '#f7768e',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Mono', 'monospace'],
        display: ['Martian Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
