"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        // On iOS, push only exists once installed to the home screen.
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setState(isIOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("Could not save subscription");
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMsg(null);
    // Ensure the session cookie is fresh for the API call.
    await createClient().auth.getSession();
    const res = await fetch("/api/push/test", { method: "POST" });
    const json = await res.json().catch(() => null);
    setMsg(
      res.ok && json?.sent > 0
        ? "Test sent — check your notifications."
        : "Couldn't send a test — try toggling off and on."
    );
    setBusy(false);
  }

  if (state === "loading") return null;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          {state === "on" ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>Notifications</CardTitle>
          {state === "needs-install" ? (
            <p className="mt-1 text-sm text-muted">
              To get alerts on your iPhone, add hearth to your Home Screen
              first: the Share button → “Add to Home Screen”, then open it from
              there and turn notifications on.
            </p>
          ) : state === "unsupported" ? (
            <p className="mt-1 text-sm text-muted">
              This browser doesn’t support notifications. Install the app to
              your home screen, or use a supported browser.
            </p>
          ) : state === "denied" ? (
            <p className="mt-1 text-sm text-muted">
              Notifications are blocked. Enable them for hearth in your device
              settings, then reload.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Gentle nudges when a feed is due and a heads-up if wet nappies are
              running low. A guide, not a schedule.
            </p>
          )}

          {(state === "on" || state === "off") && (
            <div className="mt-3 flex flex-wrap gap-2">
              {state === "off" ? (
                <Button size="sm" onClick={enable} disabled={busy}>
                  {busy ? "Enabling…" : "Turn on"}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={sendTest}
                    disabled={busy}
                  >
                    Send a test
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={disable}
                    disabled={busy}
                  >
                    Turn off
                  </Button>
                </>
              )}
            </div>
          )}
          {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
        </div>
      </div>
    </Card>
  );
}
