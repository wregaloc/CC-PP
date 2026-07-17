import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "podpulse-theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

/** Tema oscuro/claro con toggle manual, persistido en localStorage — el
 * default sigue siendo oscuro, pero ya no es forzado: cualquier usuario
 * puede cambiar a claro (botón en Navbar) y la elección se recuerda en su
 * navegador. El `<script>` inline en index.html aplica la clase `dark` al
 * `<html>` antes del primer render para evitar un flash del tema
 * equivocado; este provider solo sincroniza cambios posteriores (toggle). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}
