// Theme preference: per-device. Stored in a cookie (so the server can render
// the correct data-theme into the initial HTML — no flash of the wrong
// palette) and mirrored to localStorage. "system" follows the OS; "light"/
// "dark" force it. The CSS in globals.css keys off data-theme on <html>.
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "theme";
const DARK_BG = "#16140f";
const LIGHT_BG = "#ede9e1";

export function getThemePref(): ThemePref {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)theme=(dark|light|system)/);
    if (m) return m[1] as ThemePref;
  }
  if (typeof window !== "undefined") {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  }
  return "system";
}

function resolveDark(pref: ThemePref): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function persist(pref: ThemePref): void {
  try {
    document.cookie = `${THEME_KEY}=${pref}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode etc. */
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  persist(pref);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", resolveDark(pref) ? DARK_BG : LIGHT_BG);
}
