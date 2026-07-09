// Theme preference: per-device, stored in localStorage. "system" follows the
// OS setting; "light"/"dark" force it. Applied by setting data-theme on <html>
// (the CSS in globals.css keys off it), plus keeping the theme-color meta in
// sync so the PWA status bar matches.
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "theme";
const DARK_BG = "#16140f";
const LIGHT_BG = "#ede9e1";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : "system";
}

function resolveDark(pref: ThemePref): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", resolveDark(pref) ? DARK_BG : LIGHT_BG);
}
