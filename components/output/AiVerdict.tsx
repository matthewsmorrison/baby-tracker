import type { AiAnalysis, AnalysisAction } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";

export const ACTION_META: Record<
  AnalysisAction,
  { label: string; bg: string; fg: string }
> = {
  log_and_continue: {
    label: "Logged — carry on",
    bg: "var(--positive-bg)",
    fg: "var(--positive)",
  },
  mention_at_next_check: {
    label: "Mention at next check",
    bg: "var(--accent-soft)",
    fg: "#8a6116",
  },
  contact_midwife_today: {
    label: "Contact your midwife today",
    bg: "#F8E3CE",
    fg: "#A45A1B",
  },
  seek_urgent_advice: {
    label: "Seek urgent advice now",
    bg: "var(--alert-bg)",
    fg: "var(--alert)",
  },
};

/** Small chip summarising the AI action, for timeline rows. */
export function AiActionChip({ action }: { action: AnalysisAction }) {
  const meta = ACTION_META[action] ?? ACTION_META.log_and_continue;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

/** Full verdict card shown after analysis and on entry detail. */
export function AiVerdict({ ai }: { ai: AiAnalysis }) {
  const meta = ACTION_META[ai.action] ?? ACTION_META.log_and_continue;
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: meta.bg, borderColor: "transparent" }}
    >
      <p className="text-sm font-bold" style={{ color: meta.fg }}>
        {meta.label}
      </p>
      <p className="mt-1.5 text-sm text-ink">{ai.assessment}</p>
      {ai.note && <p className="mt-1 text-sm text-muted">{ai.note}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ai.colour && <Chip>colour: {ai.colour}</Chip>}
        {ai.consistency && <Chip>texture: {ai.consistency}</Chip>}
        {ai.feedTypeLikely && ai.feedTypeLikely !== "unclear" && (
          <Chip>{ai.feedTypeLikely}</Chip>
        )}
        {ai.stoolAmount && ai.stoolAmount !== "none" && (
          <Chip>poo: {ai.stoolAmount}</Chip>
        )}
        {ai.estimatedUrineMl != null && (
          <Chip>≈ {ai.estimatedUrineMl} ml wee</Chip>
        )}
        {ai.matchesExpected && (
          <Chip
            tone={
              ai.matchesExpected === "yes"
                ? "positive"
                : ai.matchesExpected === "no"
                  ? "alert"
                  : "neutral"
            }
          >
            {ai.matchesExpected === "yes"
              ? "matches what's expected"
              : ai.matchesExpected === "no"
                ? "not as expected"
                : `match: ${ai.matchesExpected}`}
          </Chip>
        )}
      </div>

      {ai.redFlags && ai.redFlags.length > 0 && (
        <ul className="mt-3 space-y-1">
          {ai.redFlags.map((f, i) => (
            <li key={i} className="text-sm font-medium text-alert">
              ⚠ {f}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted">
        AI photo check — a tracking aid, not a diagnosis. If you’re worried,
        contact your midwife or doctor regardless of this result.
      </p>
    </div>
  );
}
