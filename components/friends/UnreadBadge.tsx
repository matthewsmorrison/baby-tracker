"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const POLL_MS = 60_000;

/** Unread-message count bubble for the Friends nav item. Realtime bumps it
 *  the moment a message arrives or gets read; a slow poll backstops missed
 *  events. Renders nothing when there's nothing to read. */
export function UnreadBadge() {
  const supabase = useState(() => createClient())[0];
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setup = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const poll = async () => {
        const { count: n } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient", user.id)
          .is("read_at", null);
        if (!cancelled) setCount(n ?? 0);
      };

      void poll();
      interval = setInterval(poll, POLL_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible") void poll();
      };
      document.addEventListener("visibilitychange", onVisible);

      // New message in → count up instantly; read somewhere → count down.
      // Channel name must be unique per mount: the badge renders in BOTH
      // navs (desktop sidebar + mobile bottom bar), and supabase.channel()
      // returns the same instance for the same name — the second mount then
      // crashes trying to add callbacks to an already-subscribed channel.
      channel = supabase
        .channel(`unread-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient=eq.${user.id}`,
          },
          () => void poll()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `recipient=eq.${user.id}`,
          },
          () => void poll()
        )
        .subscribe();

      return () => document.removeEventListener("visibilitychange", onVisible);
    };

    const cleanupPromise = setup();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
      void cleanupPromise.then((fn) => fn?.());
    };
  }, [supabase]);

  if (count === 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
