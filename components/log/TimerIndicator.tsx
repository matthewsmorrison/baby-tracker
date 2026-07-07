"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Floating "feed timer running" pill, visible on every tab except Log.
 * Navigating away never loses the feed — this makes that visible and gives a
 * one-tap way back.
 */
export function TimerIndicator({ babyId }: { babyId: string }) {
  const pathname = usePathname();
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const key = `hearth-feed-timer-${babyId}`;
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return setElapsed(null);
        const t = JSON.parse(raw) as {
          side: string | null;
          startTs: number | null;
          acc: { left: number; right: number };
        };
        if (!t.side || !t.startTs) return setElapsed(null);
        setElapsed(t.acc.left + t.acc.right + (Date.now() - t.startTs));
      } catch {
        setElapsed(null);
      }
    };
    const first = window.setTimeout(read, 0);
    const i = setInterval(read, 1000);
    window.addEventListener("storage", read);
    return () => {
      clearTimeout(first);
      clearInterval(i);
      window.removeEventListener("storage", read);
    };
  }, [babyId]);

  if (elapsed === null || pathname.startsWith("/log")) return null;

  const sec = Math.floor(elapsed / 1000);
  const mmss = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <Link
      href="/log"
      className="fixed inset-x-0 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-card bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      Feed timing · <span className="stat-num">{mmss}</span>
      <span className="font-normal text-white/70">tap to return</span>
    </Link>
  );
}
