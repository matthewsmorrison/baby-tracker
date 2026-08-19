"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { APPEAR_OFFLINE_EVENT, APPEAR_OFFLINE_KEY } from "@/lib/presence";
import { FEED_TIMER_EVENT, feedTimerKey } from "@/lib/feedTimer";
import type { PresenceStatus } from "@/lib/types";

const HEARTBEAT_MS = 60_000;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function subscribeAppearOffline(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(APPEAR_OFFLINE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(APPEAR_OFFLINE_EVENT, onChange);
  };
}

/**
 * Invisible presence broadcaster, mounted in the app layout. Having beanlo
 * open (tab visible) publishes "online"; a running feed timer upgrades that
 * to "feeding". Nothing to press — backgrounding the app stops the
 * heartbeat and friends see the status decay to offline via the TTL.
 */
export function PresencePublisher({
  userId,
  babyId,
}: {
  userId: string;
  babyId: string;
}) {
  const supabase = useState(() => createClient())[0];
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false
  );
  // Local mirror of user_settings.appear_offline (synced from the DB below,
  // flipped instantly by the Settings toggle via the custom event).
  const appearOffline = useSyncExternalStore(
    subscribeAppearOffline,
    () => localStorage.getItem(APPEAR_OFFLINE_KEY) === "1",
    () => true // assume hidden during SSR; corrected after mount
  );
  const [feeding, setFeeding] = useState(false);

  const status: PresenceStatus = appearOffline
    ? "offline"
    : feeding
      ? "feeding"
      : visible
        ? "online"
        : "offline";

  // Cross-device sync: the DB is the source of truth for appear_offline;
  // refresh the local mirror once per mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("appear_offline")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const dbValue = data?.appear_offline === true;
      const local = localStorage.getItem(APPEAR_OFFLINE_KEY) === "1";
      if (dbValue !== local) {
        localStorage.setItem(APPEAR_OFFLINE_KEY, dbValue ? "1" : "0");
        window.dispatchEvent(new Event(APPEAR_OFFLINE_EVENT));
      } else if (localStorage.getItem(APPEAR_OFFLINE_KEY) === null) {
        localStorage.setItem(APPEAR_OFFLINE_KEY, "0");
        window.dispatchEvent(new Event(APPEAR_OFFLINE_EVENT));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // Feed-timer watcher: the FeedForm keeps its running timer in localStorage
  // and announces changes via FEED_TIMER_EVENT (storage covers other tabs),
  // so presence piggybacks with no polling.
  useEffect(() => {
    const key = feedTimerKey(babyId);
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return setFeeding(false);
        const t = JSON.parse(raw) as { side: string | null; startTs: number | null };
        setFeeding(Boolean(t.side && t.startTs));
      } catch {
        setFeeding(false);
      }
    };
    const first = window.setTimeout(read, 0);
    window.addEventListener(FEED_TIMER_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      clearTimeout(first);
      window.removeEventListener(FEED_TIMER_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [babyId]);

  // Appear-offline flips to grey immediately (the TTL alone would leave the
  // last "online" write showing for a couple of minutes).
  useEffect(() => {
    if (!appearOffline) return;
    void supabase
      .from("profiles")
      .update({
        presence_status: "offline",
        presence_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }, [appearOffline, supabase, userId]);

  // Publish on every status change and heartbeat while online/feeding. No
  // explicit "offline" write on hide — brief app switches shouldn't flicker;
  // the stale-heartbeat TTL handles real absence.
  useEffect(() => {
    if (status === "offline") return;
    const push = () => {
      void supabase
        .from("profiles")
        .update({
          presence_status: status,
          presence_at: new Date().toISOString(),
        })
        .eq("id", userId);
    };
    const first = window.setTimeout(push, 0);
    const i = setInterval(push, HEARTBEAT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(i);
    };
  }, [status, supabase, userId]);

  return null;
}
