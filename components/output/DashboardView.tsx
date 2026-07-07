"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EXPECTED_FEEDS, dayOfLife, expectedWet, expectedDirty } from "@/lib/clinical";
import { feedAmounts } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { WeightChart } from "./WeightChart";

// Categorical chart colours (validated: lightness band, chroma floor,
// CVD separation, contrast — see dataviz palette). Identity is fixed:
// breast/EBM = aqua, formula = yellow, wet = blue, dirty = orange.
const C = {
  aqua: "#1baf7a",
  yellow: "#eda100",
  blue: "#2a78d6",
  orange: "#eb6834",
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface DayRow {
  key: string;
  label: string;
  dol: number; // day of life
  feeds: number;
  nursingMin: number;
  ebm: number;
  formula: number;
  wet: number;
  dirty: number;
}

function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map(([label, colour]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: colour }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid var(--line)",
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
  fontSize: 12,
  background: "var(--surface)",
} as const;

const axisProps = {
  stroke: "var(--faint)",
  fontSize: 11,
  tickLine: false,
} as const;

export function DashboardView({
  entries,
  birthAt,
  birthWeightG,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
}) {
  const days: DayRow[] = useMemo(() => {
    const byDay = new Map<string, DayRow>();
    const today = new Date();
    const birth = new Date(birthAt);
    const start = new Date(
      Math.max(
        new Date(birth.getFullYear(), birth.getMonth(), birth.getDate()).getTime(),
        today.getTime() - 13 * DAY_MS
      )
    );
    for (let d = new Date(start); d <= today; d = new Date(d.getTime() + DAY_MS)) {
      const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
      byDay.set(dayKey(d), {
        key: dayKey(d),
        label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        dol: dayOfLife(birthAt, noon),
        feeds: 0,
        nursingMin: 0,
        ebm: 0,
        formula: 0,
        wet: 0,
        dirty: 0,
      });
    }
    for (const e of entries) {
      const row = byDay.get(dayKey(new Date(e.occurred_at)));
      if (!row) continue;
      if (e.type === "feed") {
        row.feeds += 1;
        const a = feedAmounts(e);
        row.nursingMin += a.left + a.right;
        row.ebm += a.expressed;
        row.formula += a.formula;
      } else if (e.type === "nappy") {
        if (e.wet) row.wet += 1;
        if (e.dirty) row.dirty += 1;
      }
    }
    return [...byDay.values()];
  }, [entries, birthAt]);

  const weights = entries
    .filter((e) => e.type === "weight" && e.weight_g)
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
  const birthMs = new Date(birthAt).getTime();
  const weightPoints = weights.map((w) => ({
    day: (new Date(w.occurred_at).getTime() - birthMs) / DAY_MS + 1,
    weight: w.weight_g!,
  }));
  const todayDol = dayOfLife(birthAt, new Date());

  return (
    <div className="space-y-4">
      {/* Feeds per day */}
      <Card className="p-5">
        <CardTitle>Feeds per day</CardTitle>
        <p className="mt-0.5 text-xs text-faint">
          Shaded band = the {EXPECTED_FEEDS.label} feeds/24h norm
        </p>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
              <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" />
              <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
              <ReferenceArea
                y1={EXPECTED_FEEDS.min}
                y2={EXPECTED_FEEDS.max}
                fill="var(--positive-bg)"
                fillOpacity={0.5}
                stroke="none"
              />
              <Tooltip
                cursor={{ fill: "var(--surface-alt)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) =>
                  p?.[0]
                    ? `Day ${(p[0].payload as DayRow).dol} · ${(p[0].payload as DayRow).label}`
                    : ""
                }
                formatter={(v) => [`${v}`, "feeds"]}
              />
              <Bar dataKey="feeds" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Weight */}
      <Card className="p-5">
        <CardTitle>Weight vs expected range</CardTitle>
        <p className="mt-0.5 text-xs text-faint">
          The signal to watch is the line turning upward — back to birth weight
          by ~day 10
        </p>
        <div className="mt-2 -ml-2">
          <WeightChart
            points={weightPoints}
            birthWeightG={birthWeightG}
            maxDay={todayDol}
            birthAt={birthAt}
          />
        </div>
      </Card>

      {/* Bottle volumes — the transition story */}
      <Card className="p-5">
        <CardTitle>Bottle milk per day</CardTitle>
        <p className="mt-0.5 text-xs text-faint">
          Formula shrinking while breastmilk holds is the transition working
        </p>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-alt)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) =>
                  p?.[0]
                    ? `Day ${(p[0].payload as DayRow).dol} · ${(p[0].payload as DayRow).label}`
                    : ""
                }
                formatter={(v, name) => [
                  `${v} ml`,
                  name === "ebm" ? "Expressed" : "Formula",
                ]}
              />
              <Bar
                dataKey="ebm"
                stackId="ml"
                fill={C.aqua}
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={22}
              />
              <Bar
                dataKey="formula"
                stackId="ml"
                fill={C.yellow}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend
          items={[
            ["Expressed breastmilk", C.aqua],
            ["Formula", C.yellow],
          ]}
        />
      </Card>

      {/* Nursing minutes */}
      <Card className="p-5">
        <CardTitle>Nursing per day</CardTitle>
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-alt)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) =>
                  p?.[0]
                    ? `Day ${(p[0].payload as DayRow).dol} · ${(p[0].payload as DayRow).label}`
                    : ""
                }
                formatter={(v) => [`${v} min`, "at the breast"]}
              />
              <Bar dataKey="nursingMin" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Nappies */}
      <Card className="p-5">
        <CardTitle>Nappies per day</CardTitle>
        <p className="mt-0.5 text-xs text-faint">
          Day {todayDol} norm: {expectedWet(todayDol).label} wet ·{" "}
          {expectedDirty(todayDol).label} dirty
        </p>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" />
              <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-alt)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) =>
                  p?.[0]
                    ? `Day ${(p[0].payload as DayRow).dol} · ${(p[0].payload as DayRow).label}`
                    : ""
                }
                formatter={(v, name) => [`${v}`, name === "wet" ? "Wet" : "Dirty"]}
              />
              <Bar
                dataKey="wet"
                stackId="n"
                fill={C.blue}
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={22}
              />
              <Bar
                dataKey="dirty"
                stackId="n"
                fill={C.orange}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend
          items={[
            ["Wet", C.blue],
            ["Dirty", C.orange],
          ]}
        />
      </Card>
    </div>
  );
}
