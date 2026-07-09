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

/** Consecutive gaps between feed STARTS (clinical convention), oldest→newest,
 *  each gap attributed to the moment the later feed began. */
export function feedGaps(entries: Entry[]): Array<{ at: Date; gapMs: number }> {
  const starts = entries
    .filter((e) => e.type === "feed")
    .map((e) => new Date(e.occurred_at).getTime())
    .sort((a, b) => a - b);
  const gaps: Array<{ at: Date; gapMs: number }> = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push({ at: new Date(starts[i]), gapMs: starts[i] - starts[i - 1] });
  }
  return gaps;
}

export function formatGap(ms: number): string {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** "2h 15m" from a millisecond duration. */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function entryLabel(e: Entry): string {
  if (e.type === "nappy") {
    // A nappy with poo is "Mixed" (wee assumed); otherwise "Wet".
    if (e.dirty) return "Mixed nappy";
    if (e.wet) return "Wet nappy";
    return "Nappy";
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
  if (e.type === "sleep") {
    if (e.ended_at) {
      const ms =
        new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime();
      return `Slept ${formatDuration(ms)}`;
    }
    return "Sleep";
  }
  if (e.type === "carer_sleep") {
    if (e.ended_at) {
      const ms =
        new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime();
      return `Carer slept ${formatDuration(ms)}`;
    }
    return "Carer sleep";
  }
  if (e.type === "pump") {
    const ml = e.expressed_ml ?? 0;
    const dur = e.ended_at
      ? ` · ${formatDuration(new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime())}`
      : "";
    return ml ? `Pumped ${ml} ml${dur}` : `Pumping${dur}`;
  }
  return `Weight · ${formatKg(e.weight_g ?? 0)}`;
}
