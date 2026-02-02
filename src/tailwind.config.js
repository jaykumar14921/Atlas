/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- This line is most important
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

