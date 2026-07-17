/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Tema oscuro forzado siempre, para todos los usuarios, sin depender de la
  // preferencia del sistema — decisión del usuario (antes seguía
  // prefers-color-scheme vía "media"; ver class="dark" fija en index.html).
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
