/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hub-pink': '#FFB6C1', // Light Pink
        'hub-pink-dark': '#FF69B4', // Deep Pink for buttons
        'hub-white': '#FFFFFF',
        'hub-gray': '#F9F9F9', // Very light gray for backgrounds
      }
    },
  },
  plugins: [],
}