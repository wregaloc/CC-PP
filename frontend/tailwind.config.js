/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Toggle manual claro/oscuro (default oscuro), no ligado a la preferencia
  // del sistema — ver ThemeProvider, que aplica/quita la clase "dark" según
  // la elección del usuario persistida en localStorage.
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
