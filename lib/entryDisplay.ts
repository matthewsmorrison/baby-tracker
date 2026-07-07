import { formatKg } from "./clinical";
import type { Entry } from "./types";

/** Effective bottle amounts, tolerating legacy single-volume rows. */
export function feedAmounts(e: Entry) {
  return {
    left: e.left_min ?? 0,
    right: e.right_min ?? 0,
    expressed:
      e.expressed_ml ?? (e.feed_type === "expressed" ? (e.volume_ml ?? 0) : 0),
    formula:
      e.formula_ml ?? (e.feed_type === "formula" ? (e.volume_ml ?? 0) : 0),
  };
}

export function entryLabel(e: Entry): string {
  if (e.type === "nappy") {
    const parts = [];
    if (e.wet) parts.push("Wet");
    if (e.dirty) parts.push("Dirty");
    return parts.join(" + ") || "Nappy";
  }
  if (e.type === "feed") {
    const a = feedAmounts(e);
    const parts: string[] = [];
    if (a.left || a.right) {
      const sides = [
        a.left ? `L ${a.left}m` : null,
        a.right ? `R ${a.right}m` : null,
      ]
        .filter(Boolean)
        .join(" + ");
      parts.push(sides);
    }
    if (a.expressed) parts.push(`EBM ${a.expressed} ml`);
    if (a.formula) parts.push(`Formula ${a.formula} ml`);
    return parts.length ? `Feed · ${parts.join(" · ")}` : "Feed";
  }
  return `Weight · ${formatKg(e.weight_g ?? 0)}`;
}
