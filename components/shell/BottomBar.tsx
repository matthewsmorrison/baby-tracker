"use client";

import { Nav } from "./Nav";

/**
 * Mobile bottom navigation. Rendered inline (no portal) so it's present in
 * the server HTML and paints with the first frame — none of its ancestors in
 * the app layout carry a transform, so `position: fixed` stays viewport-
 * relative. (Page-level rise animations live inside <main>, which is a
 * sibling, not an ancestor.)
 */
export function BottomBar({
  canEdit,
  aiEnabled,
}: {
  canEdit: boolean;
  aiEnabled: boolean;
}) {
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <Nav canEdit={canEdit} orientation="bottom" aiEnabled={aiEnabled} />
    </div>
  );
}
