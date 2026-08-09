import type { PresenceStatus } from "@/lib/types";

/** MSN-style status dot: hollow when offline, green when online, pulsing
 *  green while a feed timer is running. */
export function PresenceDot({ status }: { status: PresenceStatus }) {
  if (status === "offline") {
    return (
      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border-2 border-faint" />
    );
  }
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {status === "feeding" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive-bar opacity-75" />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-positive-bar" />
    </span>
  );
}
