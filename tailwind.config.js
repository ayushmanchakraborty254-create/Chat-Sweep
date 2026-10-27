/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./popup.html",
    "./dashboard.html",
    "./options.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sweep: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        darkbg: {
          900: '#0d1117',
          850: '#161b22',
          800: '#21262d',
          700: '#30363d',
        }
      }
    },
  },
  plugins: [],
}
