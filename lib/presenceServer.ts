import "server-only";
import { createServiceClient } from "./supabase/service";
import { PRESENCE_TTL_MS } from "./presence";

/**
 * Server-side presence touch: mark the user online because a page just
 * rendered for them. Called via after() from the app layout so it never
 * delays a response, and works even where client JS misbehaves (PWAs).
 * Respects appear-offline and never downgrades a live "feeding" status.
 */
export async function touchPresence(userId: string): Promise<void> {
  try {
    const service = createServiceClient();
    const [{ data: settings }, { data: profile }] = await Promise.all([
      service
        .from("user_settings")
        .select("appear_offline")
        .eq("user_id", userId)
        .maybeSingle(),
      service
        .from("profiles")
        .select("presence_status, presence_at")
        .eq("id", userId)
        .single(),
    ]);
    if (settings?.appear_offline) return;
    const feedingFresh =
      profile?.presence_status === "feeding" &&
      profile.presence_at &&
      Date.now() - Date.parse(profile.presence_at) < PRESENCE_TTL_MS;
    await service
      .from("profiles")
      .update({
        presence_status: feedingFresh ? "feeding" : "online",
        presence_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch {
    // Best-effort — presence must never break a page load.
  }
}
