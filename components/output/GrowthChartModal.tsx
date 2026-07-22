"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UK_WHO_CENTILES, whoCentile, whoWeightAtZ } from "@/lib/whoWeight";
import { formatKg } from "@/lib/clinical";
import type { BabySex } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { Segmented } from "@/components/ui/Segmented";
import { X } from "lucide-react";
import type { WeightPoint } from "./WeightChart";

const DAYS_PER_MONTH = 30.4375;

type ChartRange = "early" | "1y" | "2y";

/** "46" → "46th", "91" → "91st" — for reading a centile aloud. */
export function ordinal(n: number): string {
  const r = Math.round(n);
  const mod100 = r % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : r % 10 === 1
        ? "st"
        : r % 10 === 2
          ? "nd"
          : r % 10 === 3
            ? "rd"
            : "th";
  return `${r}${suffix}`;
}

/** Parent-friendly description of where a weight sits on the chart. */
export function centileLabel(pct: number): string {
  if (pct < 0.4) return "below the 0.4th centile";
  if (pct > 99.6) return "above the 99.6th centile";
  return `~${ordinal(pct)} centile`;
}

/**
 * Full-screen UK-WHO growth chart: the nine red book centile curves (drawn
 * from the WHO weight-for-age LMS data) with the baby's own weights plotted
 * on top. The curves are recessive context in a single muted hue, each
 * direct-labelled at its end like the printed charts; the baby's line is the
 * only prominent series.
 */
export function GrowthChartModal({
  open,
  onClose,
  points,
  birthWeightG,
  birthAt,
  sex,
}: {
  open: boolean;
  onClose: () => void;
  /** Logged weights (day = day of life, 1 at birth). */
  points: WeightPoint[];
  birthWeightG: number;
  birthAt: string;
  sex: BabySex;
}) {
  // Lock body scroll while the chart is up (same pattern as LogModal).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Baby's weights in age-days (0 = birth), birth weight included.
  const baby = useMemo(() => {
    const pts = [
      { age: 0, weight: birthWeightG },
      ...points.map((p) => ({ age: Math.max(0, p.day - 1), weight: p.weight })),
    ];
    return pts.sort((a, b) => a.age - b.age);
  }, [points, birthWeightG]);

  const latest = baby[baby.length - 1];
  const latestPct = whoCentile(sex, latest.age, latest.weight);

  // Default to the 0–1 year layout — the printed chart used through the
  // first year — with a zoom for the early weeks and 0–2 y for later.
  const [range, setRange] = useState<ChartRange>("1y");

  const { rows, maxAge, ticks, tickLabel, yMin, yMax } = useMemo(() => {
    const maxAge =
      range === "early"
        ? Math.min(182, Math.max(56, Math.ceil(latest.age * 1.3)))
        : range === "1y"
          ? 365
          : 730;

    const rows: Array<Record<string, number>> = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const age = (maxAge * i) / steps;
      const row: Record<string, number> = { age };
      UK_WHO_CENTILES.forEach((c, ci) => {
        row[`c${ci}`] = whoWeightAtZ(sex, age, c.z);
      });
      rows.push(row);
    }

    // Week ticks up to ~6 months, month ticks beyond.
    const useWeeks = maxAge <= 26 * 7;
    const ticks: number[] = [];
    if (useWeeks) {
      const maxWeeks = Math.ceil(maxAge / 7);
      const step = maxWeeks <= 10 ? 1 : maxWeeks <= 20 ? 2 : 4;
      for (let w = 0; w * 7 <= maxAge; w += step) ticks.push(w * 7);
    } else {
      const maxMonths = Math.ceil(maxAge / DAYS_PER_MONTH);
      const step = maxMonths <= 12 ? 1 : 2;
      for (let m = 0; m * DAYS_PER_MONTH <= maxAge; m += step)
        ticks.push(m * DAYS_PER_MONTH);
    }
    const tickLabel = (age: number) =>
      useWeeks ? `${Math.round(age / 7)}w` : `${Math.round(age / DAYS_PER_MONTH)}m`;

    const inRange = baby.filter((b) => b.age <= maxAge);
    const lows = rows.map((r) => r.c0);
    const highs = rows.map((r) => r.c8);
    const weights = inRange.map((b) => b.weight);
    const yMin = Math.max(
      0,
      Math.floor(Math.min(...lows, ...weights) / 250) * 250 - 250
    );
    const yMax = Math.ceil(Math.max(...highs, ...weights) / 250) * 250 + 250;

    return { rows, maxAge, ticks, tickLabel, yMin, yMax };
  }, [sex, baby, latest.age, range]);

  const data = useMemo(
    () =>
      [
        ...rows,
        ...baby
          .filter((b) => b.age <= maxAge)
          .map((b) => ({ age: b.age, weight: b.weight })),
      ].sort((a, b) => (a.age as number) - (b.age as number)),
    [rows, baby, maxAge]
  );

  if (!open) return null;

  // Direct-label each centile curve at its right end, like the printed chart.
  // The final data row is always the curve endpoint (curves extend past the
  // baby's points), so only that index gets the label.
  const endLabel = (label: string, emphasised: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function CentileEndLabel(p: any) {
      if (p.index !== data.length - 1) return <g key={p.index} />;
      return (
        <text
          key={p.index}
          x={p.x + 4}
          y={p.y + 3}
          fontSize={9}
          fill={emphasised ? "var(--muted)" : "var(--faint)"}
          fontWeight={emphasised ? 600 : 400}
        >
          {label}
        </text>
      );
    }
    return CentileEndLabel;
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              Growth chart · UK-WHO centiles ({sex})
            </h2>
            <p className="truncate text-xs text-muted">
              Latest {formatKg(latest.weight)} · {centileLabel(latestPct)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close growth chart"
            className="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-2">
          <Segmented<ChartRange>
            options={[
              { value: "early", label: "First weeks" },
              { value: "1y", label: "0–1 y" },
              { value: "2y", label: "0–2 y" },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>

        <div className="min-h-0 flex-1 px-1 py-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 34, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="0" />
              <XAxis
                dataKey="age"
                type="number"
                domain={[0, maxAge]}
                ticks={ticks}
                tickFormatter={tickLabel}
                stroke="var(--faint)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(g: number) => `${(g / 1000).toFixed(1)}`}
                unit=""
                stroke="var(--faint)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={34}
                label={{
                  value: "kg",
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: "var(--faint)",
                  dy: -6,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.find((p) => p.dataKey === "weight");
                  if (!active || !point) return null;
                  const age = (point.payload as { age: number }).age;
                  const w = point.value as number;
                  return (
                    <div
                      className="rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs shadow-card"
                      style={{ boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}
                    >
                      <p className="font-semibold">
                        {age < 1
                          ? "Birth"
                          : new Date(
                              new Date(birthAt).getTime() + age * 86_400_000
                            ).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                        · {Math.floor(age / 7)}w {Math.round(age % 7)}d
                      </p>
                      <p className="mt-0.5 text-muted">
                        {formatKg(w)} · {centileLabel(whoCentile(sex, age, w))}
                      </p>
                    </div>
                  );
                }}
              />
              {UK_WHO_CENTILES.map((c, ci) => {
                const median = c.z === 0;
                return (
                  <Line
                    key={c.label}
                    dataKey={`c${ci}`}
                    stroke={median ? "var(--muted)" : "var(--faint)"}
                    strokeWidth={median ? 1.5 : 1}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    isAnimationActive={false}
                    label={endLabel(c.label, median)}
                  />
                );
              })}
              <Line
                dataKey="weight"
                stroke="var(--ink)"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 4, fill: "var(--ink)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="border-t border-line px-4 py-2.5 text-center text-[11px] leading-snug text-faint">
          Curves: the nine UK-WHO centiles (WHO weight-for-age, {sex}s 0–24
          months). Term babies (37–42 weeks) are plotted from birth with no
          gestational correction — correction applies to preterm babies. A
          guide for parents — your red book chart, plotted by your midwife or
          health visitor, remains the clinical reference.
        </p>
      </div>
    </Portal>
  );
}
