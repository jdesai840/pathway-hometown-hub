/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Parity-first palette: Olympic + Paralympic get equal-weight, distinct-but-equal accents.
        olympic: { DEFAULT: "#3b82f6", deep: "#1e40af" },
        paralympic: { DEFAULT: "#f59e0b", deep: "#b45309" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
