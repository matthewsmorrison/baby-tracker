"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 30_000;

/** Unread-message count bubble for the Friends nav item. Polls quietly;
 *  renders nothing when there's nothing to read. */
export function UnreadBadge() {
  const supabase = useState(() => createClient())[0];
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count: n } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient", user.id)
        .is("read_at", null);
      if (!cancelled) setCount(n ?? 0);
    };
    const first = window.setTimeout(() => void poll(), 0);
    const i = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase]);

  if (count === 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
