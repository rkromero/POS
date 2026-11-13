/** @type {import('tailwindcss').Config} */
export default {
  // hover sólo en dispositivos con puntero (evita estados :hover pegados en tablet)
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mimi: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          500: '#E91E8C',
          600: '#C4187A',
          700: '#9D1462',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
