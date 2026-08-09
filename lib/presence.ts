import type { PresenceStatus } from "./types";

/** How stale a presence heartbeat can be before a friend is shown offline.
 *  Heartbeats are sent every 60s, so this allows one missed beat + slack. */
export const PRESENCE_TTL_MS = 150_000;

/** localStorage mirror of user_settings.appear_offline, so the presence
 *  publisher reacts instantly without a DB round-trip; the table is the
 *  cross-device source of truth. */
export const APPEAR_OFFLINE_KEY = "beanlo-appear-offline";
/** Fired after the toggle writes the mirror (storage events don't fire in
 *  the tab that wrote them). */
export const APPEAR_OFFLINE_EVENT = "beanlo-appear-offline-change";

/** The status to actually display: whatever was last written, demoted to
 *  offline once the heartbeat is stale (closed tab, dead battery…). */
export function effectivePresence(
  status: PresenceStatus | null | undefined,
  at: string | null | undefined,
  now: number = Date.now()
): PresenceStatus {
  if (!status || status === "offline" || !at) return "offline";
  return now - Date.parse(at) <= PRESENCE_TTL_MS ? status : "offline";
}

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  offline: "offline",
  online: "online",
  feeding: "feeding now",
};
