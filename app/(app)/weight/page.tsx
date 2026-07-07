import { getBabyContext, getEntries } from "@/lib/data";
import {
  DISCLAIMER,
  dayOfLife,
  expectedWeightBand,
  formatKg,
  weightStatus,
} from "@/lib/clinical";
import { formatDateTime } from "@/lib/dates";
import { Card, CardTitle } from "@/components/ui/Card";
import { WeightChart } from "@/components/output/WeightChart";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function WeightPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);
  const weights = entries
    .filter((e) => e.type === "weight" && e.weight_g)
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

  const birth = new Date(ctx.baby.birth_at).getTime();
  const points = weights.map((w) => ({
    day: (new Date(w.occurred_at).getTime() - birth) / DAY_MS + 1,
    weight: w.weight_g!,
  }));
  const today = dayOfLife(ctx.baby.birth_at, new Date());

  return (
    <div className="space-y-4 animate-rise">
      <Card className="p-5">
        <CardTitle>Weight vs expected range</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Early loss is normal. The signal to watch is the line{" "}
          <span className="font-semibold text-ink">turning upward</span> —
          most babies are back to birth weight by around day 10.
        </p>
        <div className="mt-4 -ml-2">
          <WeightChart
            points={points}
            birthWeightG={ctx.baby.birth_weight_g}
            maxDay={today}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" /> actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full bg-positive-bg" /> expected
            range
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-muted" />{" "}
            birth weight
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-3">Weigh-ins</CardTitle>
        {weights.length === 0 ? (
          <p className="text-sm text-muted">
            No weights logged yet — add one in Log, including past days.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...weights].reverse().map((w) => {
              const day = dayOfLife(ctx.baby.birth_at, w.occurred_at);
              const band = expectedWeightBand(day, ctx.baby.birth_weight_g);
              const ws = weightStatus(w.weight_g!, ctx.baby.birth_weight_g);
              return (
                <li key={w.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold stat-num">
                      {formatKg(w.weight_g!)}
                    </p>
                    <p className="text-xs text-muted">
                      Day {day} · {formatDateTime(w.occurred_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold stat-num ${
                        ws.tone === "positive"
                          ? "text-positive"
                          : ws.tone === "alert"
                            ? "text-alert"
                            : ws.tone === "watch"
                              ? "text-[#A45A1B]"
                              : "text-ink"
                      }`}
                    >
                      {ws.pct >= 0 ? "+" : ""}
                      {ws.pct.toFixed(1)}% vs birth
                    </p>
                    <p className="text-xs text-muted">
                      expected ≈ {formatKg(band.mid)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
