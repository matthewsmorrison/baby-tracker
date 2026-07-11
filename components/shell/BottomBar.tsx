"use client";

import { Portal } from "@/components/ui/Portal";
import { Nav } from "./Nav";

/**
 * Mobile bottom navigation. Rendered through a portal to <body> so its
 * `position: fixed` is always relative to the viewport — a transformed
 * ancestor (e.g. the page's rise animation) would otherwise contain it and
 * make it scroll away instead of staying pinned.
 */
export function BottomBar({
  canEdit,
  aiEnabled,
}: {
  canEdit: boolean;
  aiEnabled: boolean;
}) {
  return (
    <Portal>
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <Nav canEdit={canEdit} orientation="bottom" aiEnabled={aiEnabled} />
      </div>
    </Portal>
  );
}
