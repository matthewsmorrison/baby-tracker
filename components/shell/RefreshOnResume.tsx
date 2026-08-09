"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Don't refresh again if we already did within this window (rapid app
 *  switching shouldn't hammer the server). */
const MIN_AGE_MS = 30_000;

/**
 * Re-fetches the current page's server data when the app comes back to the
 * foreground. Without this, reopening the installed PWA shows the snapshot
 * from whenever it was last open — users had to switch tabs and back to see
 * fresh data. router.refresh() re-renders in place, so nothing flashes.
 */
export function RefreshOnResume() {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    // Baseline: the page has just rendered fresh, so an immediate focus
    // event (fired by some browsers on load) shouldn't trigger a refresh.
    lastRefreshRef.current = Date.now();
    const refresh = (force = false) => {
      if (!force && Date.now() - lastRefreshRef.current < MIN_AGE_MS) return;
      lastRefreshRef.current = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // Restored from the back/forward cache — the data is definitely old.
      if (e.persisted) refresh(true);
    };
    // visibilitychange only — window "focus" also fires on keyboard close
    // and sheet dismissal, and a refresh kicked off there can race (and
    // swallow) a nav tap made moments later.
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
