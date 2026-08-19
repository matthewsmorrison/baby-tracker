"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FEED_TIMER_EVENT, feedTimerKey } from "@/lib/feedTimer";
import { OPEN_LOG_EVENT } from "./LogModal";

/**
 * Floating "feed timer running" pill, visible on every tab except Log.
 * Navigating away never loses the feed — this makes that visible and gives a
 * one-tap way back. State changes arrive as events (FeedForm dispatches for
 * this tab, `storage` covers other tabs); the 1 s tick only runs while a
 * timer is actually going, instead of polling localStorage forever.
 */
export function TimerIndicator({ babyId }: { babyId: string }) {
  const pathname = usePathname();
  const [timer, setTimer] = useState<{
    startTs: number;
    accMs: number;
  } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const key = feedTimerKey(babyId);
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return setTimer(null);
        const t = JSON.parse(raw) as {
          side: string | null;
          startTs: number | null;
          acc: { left: number; right: number };
        };
        if (!t.side || !t.startTs) return setTimer(null);
        setTimer({ startTs: t.startTs, accMs: t.acc.left + t.acc.right });
        setNow(Date.now());
      } catch {
        setTimer(null);
      }
    };
    const first = window.setTimeout(read, 0);
    window.addEventListener(FEED_TIMER_EVENT, read);
    window.addEventListener("storage", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      clearTimeout(first);
      window.removeEventListener(FEED_TIMER_EVENT, read);
      window.removeEventListener("storage", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [babyId]);

  // Re-render each second to advance the display — only while running.
  useEffect(() => {
    if (!timer) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [timer]);

  if (timer === null) return null;
  // Chat screens stay free of overlays — the timer keeps running in
  // localStorage and the pill reappears on any other tab.
  if (pathname.startsWith("/chat") || /^\/friends\/[^/]+/.test(pathname)) {
    return null;
  }

  const elapsed = timer.accMs + Math.max(0, now - timer.startTs);
  const sec = Math.floor(elapsed / 1000);
  const mmss = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <button
      type="button"
      // Open the feed form in place, instantly — no navigation. The form
      // restores the running timer from localStorage when it mounts.
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(OPEN_LOG_EVENT, { detail: { tab: "feed" } })
        )
      }
      className="fixed inset-x-0 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink shadow-card bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      Feed timing · <span className="stat-num">{mmss}</span>
      <span className="font-normal text-on-ink/70">tap to return</span>
    </button>
  );
}
