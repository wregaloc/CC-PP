/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Respeta la preferencia del sistema por defecto (ver skill react-enterprise-frontend).
  // Cambiar a 'class' si en una fase futura se agrega un toggle manual de tema.
  darkMode: "media",
  theme: {
    extend: {},
  },
  plugins: [],
};
