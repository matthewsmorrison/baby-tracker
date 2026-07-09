import { expectedNappies } from "@/lib/clinical";
import { Card, CardTitle } from "@/components/ui/Card";

const DIRTY = "#7A5A3A"; // poo — warm brown
const WET = "#2a78d6"; // wee — blue

/**
 * Horizontal nappy tracker for the last 24h: a row of the day's expected
 * nappies (faint when not yet logged), filled with dirty (brown) then wet
 * (blue) as they're logged, against the NCT quota — a total for the day with
 * a minimum number that should be dirty.
 */
export function NappyQuota({
  day,
  dirtyCount,
  wetCount,
}: {
  day: number;
  dirtyCount: number;
  wetCount: number;
}) {
  const exp = expectedNappies(day);
  const total = dirtyCount + wetCount;
  const slots = Math.max(exp.total, total);

  const cells: Array<"dirty" | "wet" | "empty"> = [];
  for (let i = 0; i < slots; i++) {
    if (i < dirtyCount) cells.push("dirty");
    else if (i < total) cells.push("wet");
    else cells.push("empty");
  }

  const quotaMet = total >= exp.total;
  const dirtyMet = dirtyCount >= exp.minDirty;
  const allGood = quotaMet && dirtyMet;

  const parts: string[] = [];
  if (!quotaMet) parts.push(`${exp.total - total} more nappy${exp.total - total === 1 ? "" : "s"}`);
  if (!dirtyMet)
    parts.push(`${exp.minDirty - dirtyCount} more mixed`);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <CardTitle>Nappies · last 24h</CardTitle>
        <span
          className={`text-xs font-semibold ${
            allGood ? "text-positive" : "text-watch"
          }`}
        >
          {allGood ? "On track ✓" : `Need ${parts.join(" · ")}`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {cells.map((c, i) => (
          <span
            key={i}
            title={c === "dirty" ? "Dirty" : c === "wet" ? "Wet" : "Expected"}
            className="flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-semibold"
            style={
              c === "empty"
                ? {
                    minWidth: 28,
                    border: "1.5px dashed var(--line)",
                    color: "var(--faint)",
                  }
                : {
                    minWidth: 28,
                    background: c === "dirty" ? DIRTY : WET,
                    color: "#fff",
                  }
            }
          >
            {c === "dirty" ? "💩" : c === "wet" ? "" : ""}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WET }} />
          {wetCount} wet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIRTY }} />
          {dirtyCount} mixed
          <span className={dirtyMet ? "text-positive" : "text-watch"}>
            {" "}
            (aim {exp.minDirty}+)
          </span>
        </span>
        <span className="text-faint">·</span>
        <span className="text-muted">
          {total} of {exp.total} for day {day}
        </span>
      </div>
      <p className="mt-2 text-xs text-faint">{exp.note}</p>
    </Card>
  );
}
