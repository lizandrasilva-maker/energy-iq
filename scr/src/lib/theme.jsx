import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "energyiq-theme";
const ThemeContext = createContext({ theme: "light", toggleTheme: () => {}, setTheme: () => {} });

function readInitialTheme() {
  // O script em index.html já aplicou o tema antes do React carregar.
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* armazenamento indisponível: o tema só não é lembrado */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
