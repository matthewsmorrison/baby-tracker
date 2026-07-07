import { formatKg } from "./clinical";
import type { Entry } from "./types";

export function entryLabel(e: Entry): string {
  if (e.type === "nappy") {
    const parts = [];
    if (e.wet) parts.push("Wet");
    if (e.dirty) parts.push("Dirty");
    return parts.join(" + ") || "Nappy";
  }
  if (e.type === "feed") {
    if (e.feed_type === "breast") {
      const l = e.left_min ? `L ${e.left_min}m` : null;
      const r = e.right_min ? `R ${e.right_min}m` : null;
      return `Breastfeed · ${[l, r].filter(Boolean).join(" + ") || "—"}`;
    }
    return `${e.feed_type === "formula" ? "Formula" : "Expressed milk"} · ${e.volume_ml} ml`;
  }
  return `Weight · ${formatKg(e.weight_g ?? 0)}`;
}
