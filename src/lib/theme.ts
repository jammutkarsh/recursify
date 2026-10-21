"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "recursify-theme";

/** Inline script for <head>: applies the saved theme before paint. Default is light. */
export const THEME_INIT = `(() => { try { const t = localStorage.getItem("${KEY}") || "light"; const m = matchMedia("(prefers-color-scheme: dark)"); const apply = () => document.documentElement.classList.toggle("dark", t === "dark" || (t === "system" && m.matches)); apply(); m.addEventListener("change", apply); } catch {} })();`;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => { try { setThemeState((localStorage.getItem(KEY) as Theme) || "light"); } catch { /* storage blocked */ } }, []);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", dark);
    setTimeout(() => root.classList.remove("theme-switching"), 300);
  };
  return { theme, setTheme };
}
