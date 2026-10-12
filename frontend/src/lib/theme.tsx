import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute("data-theme") as Theme) || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#09101d" : "#0C3C7A");
    try { localStorage.setItem("mh-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
