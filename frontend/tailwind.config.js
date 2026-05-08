/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6',
        brand2: '#60a5fa',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
