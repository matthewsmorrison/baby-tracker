"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Render children on document.body. Required for fixed-position overlays
 * (snackbar, camera, lightbox): page containers animate in with a transform,
 * and a transformed ancestor hijacks position:fixed descendants.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}
