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
import { whoMeasureAtZ, whoMeasureCentile } from "@/lib/whoGrowth";
import { formatKg } from "@/lib/clinical";
import type { BabySex } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { Segmented } from "@/components/ui/Segmented";
import { X } from "lucide-react";

const DAYS_PER_MONTH = 30.4375;

// The red book prints the boys' chart in blue and the girls' in pink; the
// centile curves are reference context, all nine at equal weight.
const CURVE_COLOUR: Record<BabySex, string> = {
  boy: "#4383b4",
  girl: "#c76585",
};

/** A logged measurement: age in days since birth + value in that measure's unit. */
export interface MeasurePoint {
  age: number;
  value: number;
}

type Measure = "weight" | "height" | "head";

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

/** Parent-friendly description of where a measurement sits on the chart. */
export function centileLabel(pct: number): string {
  if (pct < 0.4) return "below the 0.4th centile";
  if (pct > 99.6) return "above the 99.6th centile";
  return `~${ordinal(pct)} centile`;
}

/** Centile-line label as printed on the charts: "50th", "0.4th", "99.6th". */
function curveLabelText(label: string): string {
  return /\./.test(label) ? `${label}th` : ordinal(Number(label));
}

/**
 * Full-screen UK-WHO growth charts, laid out like the red book pages: nine
 * equal-weight centile curves (blue for boys, pink for girls) over a fine
 * weekly grid, each labelled at its end, the baby's own measurements bold on
 * top. One page per measure — weight, height/length, head circumference —
 * on the 0–1 year layout (0–2 once the baby is old enough).
 */
export function GrowthChartModal({
  open,
  onClose,
  weightPoints,
  heightPoints,
  headPoints,
  birthAt,
  sex,
}: {
  open: boolean;
  onClose: () => void;
  /** Weights in grams (birth weight included by the caller). */
  weightPoints: MeasurePoint[];
  /** Lengths/heights in cm. */
  heightPoints: MeasurePoint[];
  /** Head circumferences in cm. */
  headPoints: MeasurePoint[];
  birthAt: string;
  sex: BabySex;
}) {
  const [measure, setMeasure] = useState<Measure>("weight");

  // Lock body scroll while the chart is up (same pattern as LogModal).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cfg = useMemo(() => {
    const configs: Record<
      Measure,
      {
        title: string;
        points: MeasurePoint[];
        atZ: (age: number, z: number) => number;
        centile: (age: number, value: number) => number;
        format: (value: number) => string;
        yStep: (span: number) => number;
        yTickLabel: (value: number) => string;
      }
    > = {
      weight: {
        title: "Weight",
        points: weightPoints,
        atZ: (age, z) => whoWeightAtZ(sex, age, z),
        centile: (age, v) => whoCentile(sex, age, v),
        format: formatKg,
        yStep: (span) => (span <= 2600 ? 250 : span <= 5200 ? 500 : 1000),
        yTickLabel: (g) => (g % 1000 === 0 ? `${g / 1000}kg` : `${(g / 1000).toFixed(2)}`),
      },
      height: {
        title: "Height / length",
        points: heightPoints,
        atZ: (age, z) => whoMeasureAtZ("length", sex, age, z),
        centile: (age, v) => whoMeasureCentile("length", sex, age, v),
        format: (v) => `${v.toFixed(1)} cm`,
        yStep: (span) => (span <= 16 ? 1 : 2),
        yTickLabel: (v) => `${v}cm`,
      },
      head: {
        title: "Head circumference",
        points: headPoints,
        atZ: (age, z) => whoMeasureAtZ("head", sex, age, z),
        centile: (age, v) => whoMeasureCentile("head", sex, age, v),
        format: (v) => `${v.toFixed(1)} cm`,
        yStep: () => 1,
        yTickLabel: (v) => `${v}cm`,
      },
    };
    return configs[measure];
  }, [measure, weightPoints, heightPoints, headPoints, sex]);

  const points = useMemo(
    () => [...cfg.points].sort((a, b) => a.age - b.age),
    [cfg.points]
  );
  const latest = points[points.length - 1] ?? null;

  const { data, maxAge, xTicks, xLabel, xAxisName, yTicks, yMin, yMax } =
    useMemo(() => {
      // The 0–1 year red book page; 0–2 once the baby outgrows it.
      const oldest = Math.max(0, ...points.map((p) => p.age));
      const maxAge = oldest > 350 ? 730 : 365;

      const rows: Array<Record<string, number>> = [];
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const age = (maxAge * i) / steps;
        const row: Record<string, number> = { age };
        UK_WHO_CENTILES.forEach((c, ci) => {
          row[`c${ci}`] = cfg.atZ(age, c.z);
        });
        rows.push(row);
      }

      // Red book x-axis: weekly grid with labels every 4 weeks on the 0–1
      // page; months on the 0–2 page.
      const useWeeks = maxAge <= 400;
      const xTicks: number[] = [];
      let xLabel: (age: number) => string;
      if (useWeeks) {
        for (let w = 0; w * 7 <= maxAge; w++) xTicks.push(w * 7);
        xLabel = (age) => {
          const w = Math.round(age / 7);
          return w % 4 === 0 ? `${w}` : "";
        };
      } else {
        for (let m = 0; m * DAYS_PER_MONTH <= maxAge; m++)
          xTicks.push(m * DAYS_PER_MONTH);
        xLabel = (age) => {
          const m = Math.round(age / DAYS_PER_MONTH);
          return m % 2 === 0 ? `${m}` : "";
        };
      }
      const xAxisName = useWeeks ? "age (weeks)" : "age (months)";

      // Y fits the curves plus the baby's points, on a fine grid.
      const lo = Math.min(rows[0].c0, ...points.map((p) => p.value));
      const hi = Math.max(rows[rows.length - 1].c8, ...points.map((p) => p.value));
      const step = cfg.yStep(hi - lo);
      const yMin = Math.max(0, Math.floor(lo / step) * step - step);
      const yMax = Math.ceil(hi / step) * step + step;
      const yTicks: number[] = [];
      for (let y = yMin; y <= yMax; y += step) yTicks.push(y);

      const data = [
        ...rows,
        ...points.map((p) => ({ age: p.age, value: p.value })),
      ].sort((a, b) => (a.age as number) - (b.age as number));

      return { data, maxAge, xTicks, xLabel, xAxisName, yTicks, yMin, yMax };
    }, [cfg, points]);

  if (!open) return null;

  const curveColour = CURVE_COLOUR[sex];

  // Direct-label each centile curve at its right end, like the printed chart.
  // The final data row is always a curve row (curves span the whole domain).
  const endLabel = (label: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function CentileEndLabel(p: any) {
      if (p.index !== data.length - 1) return <g key={p.index} />;
      return (
        <text
          key={p.index}
          x={p.x - 2}
          y={p.y - 4}
          fontSize={9}
          fontWeight={600}
          textAnchor="end"
          fill={curveColour}
        >
          {curveLabelText(label)}
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
              Growth · UK-WHO centiles ({sex})
            </h2>
            <p className="truncate text-xs text-muted">
              {latest
                ? `Latest ${cfg.format(latest.value)} · ${centileLabel(
                    cfg.centile(latest.age, latest.value)
                  )}`
                : `No ${cfg.title.toLowerCase()} logged yet — add it under Log → Measurements`}
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
          <Segmented<Measure>
            options={[
              { value: "weight", label: "Weight" },
              { value: "height", label: "Height" },
              { value: "head", label: "Head" },
            ]}
            value={measure}
            onChange={setMeasure}
          />
        </div>

        <div className="min-h-0 flex-1 px-1 py-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 14, right: 10, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="0" />
              <XAxis
                dataKey="age"
                type="number"
                domain={[0, maxAge]}
                ticks={xTicks}
                tickFormatter={xLabel}
                stroke="var(--faint)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                label={{
                  value: xAxisName,
                  position: "insideBottomRight",
                  fontSize: 10,
                  fill: "var(--faint)",
                  dy: -2,
                }}
              />
              <YAxis
                domain={[yMin, yMax]}
                ticks={yTicks}
                tickFormatter={cfg.yTickLabel}
                stroke="var(--faint)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.find((p) => p.dataKey === "value");
                  if (!active || !point) return null;
                  const age = (point.payload as { age: number }).age;
                  const v = point.value as number;
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
                        {cfg.format(v)} · {centileLabel(cfg.centile(age, v))}
                      </p>
                    </div>
                  );
                }}
              />
              {UK_WHO_CENTILES.map((c, ci) => (
                <Line
                  key={c.label}
                  dataKey={`c${ci}`}
                  stroke={curveColour}
                  strokeWidth={1.25}
                  strokeOpacity={0.8}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                  label={endLabel(c.label)}
                />
              ))}
              <Line
                dataKey="value"
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
          The nine UK-WHO centiles (WHO {measure === "weight"
            ? "weight-for-age"
            : measure === "height"
              ? "length-for-age"
              : "head-circumference-for-age"}, {sex}s 0–24 months). Term babies
          (37–42 weeks) are plotted from birth with no gestational correction.
          A guide for parents — your red book chart, plotted by your midwife or
          health visitor, remains the clinical reference.
        </p>
      </div>
    </Portal>
  );
}
