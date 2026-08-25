import "server-only";
import webpush from "web-push";
import { createServiceClient } from "./supabase/service";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:hello@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a payload to every subscription for the given users — web push and,
 * when APNs is configured, native iOS — pruning any endpoint the service
 * reports as gone. Returns how many were delivered.
 */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  if (userIds.length === 0) return 0;
  // Native iOS first; failures there must never block web push.
  let apnsSent = 0;
  try {
    const { sendApnsToUsers } = await import("./apns");
    apnsSent = await sendApnsToUsers(userIds, payload);
  } catch (e) {
    console.error("apns error:", e instanceof Error ? e.message : e);
  }
  configure();
  const service = createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const json = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    })
  );
  if (dead.length) {
    await service.from("push_subscriptions").delete().in("id", dead);
  }
  return sent + apnsSent;
}
