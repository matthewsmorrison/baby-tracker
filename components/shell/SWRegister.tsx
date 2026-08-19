"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on app boot. Previously registration only
 * happened inside the push-notifications toggle, so most installs had no
 * service worker at all — and therefore no offline page and no static-asset
 * cache. `updateViaCache: "none"` makes the browser revalidate sw.js itself
 * on each check, so new versions roll out promptly.
 */
export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    register();
    // Resuming the PWA is the natural moment to pick up a new deploy.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
