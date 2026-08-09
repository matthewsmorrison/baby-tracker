"use client";

import { OPEN_LOG_EVENT } from "./LogModal";

/** Opens the log modal on a given tab from anywhere (server pages included). */
export function OpenLogButton({
  tab,
  className,
  children,
}: {
  tab: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(OPEN_LOG_EVENT, { detail: { tab } })
        )
      }
      className={className}
    >
      {children}
    </button>
  );
}
