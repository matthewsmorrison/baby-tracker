"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { X } from "lucide-react";
import type { WeightPoint } from "./WeightChart";

const DAYS_PER_MONTH = 30.4375;
const MAX_AGE = 730; // the LMS data covers 0–24 months
const MIN_SPAN = 28; // can't zoom tighter than 4 weeks
const DEFAULT_VIEW = { min: 0, max: 365 }; // the red book 0–1 year page

// The red book prints the boys' chart in blue and the girls' in pink; the
// centile curves are reference context, all nine at equal weight.
const CURVE_COLOUR: Record<BabySex, string> = {
  boy: "#4383b4",
  girl: "#c76585",
};

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

/** Centile-line label as printed on the charts: "50th", "0.4th", "99.6th". */
function curveLabelText(label: string): string {
  return /\./.test(label) ? `${label}th` : ordinal(Number(label));
}

interface View {
  min: number;
  max: number;
}

function clampView(min: number, span: number): View {
  const s = Math.min(MAX_AGE, Math.max(MIN_SPAN, span));
  const m = Math.min(MAX_AGE - s, Math.max(0, min));
  return { min: m, max: m + s };
}

/**
 * Full-screen UK-WHO growth chart, laid out like the red book pages: nine
 * equal-weight centile curves (blue for boys, pink for girls) over a fine
 * weekly grid, each labelled at its end, with the baby's own weights bold on
 * top. Opens on the 0–1 year view; pinch or scroll to zoom, drag to pan,
 * double-tap to reset.
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
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>()); // pointerId → clientX
  const gesture = useRef<
    | { kind: "drag"; startX: number; startView: View }
    | { kind: "pinch"; startDist: number; centerFrac: number; startView: View }
    | null
  >(null);

  // Lock body scroll while the chart is up (same pattern as LogModal).
  useEffect(() => {
    if (!open) return;
    setView(DEFAULT_VIEW);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Wheel zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const el = wrapRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      setView((v) => {
        const span = v.max - v.min;
        const newSpan = span * (e.deltaY > 0 ? 1.15 : 1 / 1.15);
        const anchor = v.min + frac * span;
        return clampView(anchor - frac * Math.min(MAX_AGE, Math.max(MIN_SPAN, newSpan)), newSpan);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  function startGesture() {
    const el = wrapRef.current;
    if (!el) return;
    const xs = [...pointers.current.values()];
    const rect = el.getBoundingClientRect();
    if (xs.length >= 2) {
      const dist = Math.max(12, Math.abs(xs[0] - xs[1]));
      const centerFrac = ((xs[0] + xs[1]) / 2 - rect.left) / rect.width;
      gesture.current = {
        kind: "pinch",
        startDist: dist,
        centerFrac: Math.min(1, Math.max(0, centerFrac)),
        startView: view,
      };
    } else if (xs.length === 1) {
      gesture.current = { kind: "drag", startX: xs[0], startView: view };
    } else {
      gesture.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, e.clientX);
    startGesture();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const el = wrapRef.current;
    const g = gesture.current;
    if (!el || !g) return;
    const rect = el.getBoundingClientRect();
    const xs = [...pointers.current.values()];
    if (g.kind === "pinch" && xs.length >= 2) {
      const dist = Math.max(12, Math.abs(xs[0] - xs[1]));
      const startSpan = g.startView.max - g.startView.min;
      const newSpan = Math.min(MAX_AGE, Math.max(MIN_SPAN, (startSpan * g.startDist) / dist));
      const anchor = g.startView.min + g.centerFrac * startSpan;
      setView(clampView(anchor - g.centerFrac * newSpan, newSpan));
    } else if (g.kind === "drag" && xs.length === 1) {
      const span = g.startView.max - g.startView.min;
      const shift = (-(xs[0] - g.startX) / rect.width) * span;
      setView(clampView(g.startView.min + shift, span));
    }
  }
  function onPointerEnd(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    startGesture(); // 2 fingers → 1 continues as a pan from here
  }

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

  const { data, xTicks, xLabel, yTicks, yMin, yMax } = useMemo(() => {
    const span = view.max - view.min;

    const rows: Array<Record<string, number>> = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const age = view.min + (span * i) / steps;
      const row: Record<string, number> = { age };
      UK_WHO_CENTILES.forEach((c, ci) => {
        row[`c${ci}`] = whoWeightAtZ(sex, age, c.z);
      });
      rows.push(row);
    }

    // Red book x-axis: a fine weekly grid with labels every 1/2/4 weeks;
    // months once zoomed out past ~13 months.
    const useWeeks = span <= 400;
    const xTicks: number[] = [];
    let xLabel: (age: number) => string;
    if (useWeeks) {
      const labelEvery = span <= 120 ? 1 : span <= 250 ? 2 : 4;
      for (let w = Math.ceil(view.min / 7); w * 7 <= view.max; w++) xTicks.push(w * 7);
      xLabel = (age) => {
        const w = Math.round(age / 7);
        return w % labelEvery === 0 ? `${w}` : "";
      };
    } else {
      for (
        let m = Math.ceil(view.min / DAYS_PER_MONTH);
        m * DAYS_PER_MONTH <= view.max;
        m++
      )
        xTicks.push(m * DAYS_PER_MONTH);
      xLabel = (age) => `${Math.round(age / DAYS_PER_MONTH)}m`;
    }

    // Y fits what's visible, on a red-book-style fine grid.
    const inRange = baby.filter((b) => b.age >= view.min && b.age <= view.max);
    const lo = Math.min(rows[0].c0, ...inRange.map((b) => b.weight));
    const hi = Math.max(rows[rows.length - 1].c8, ...inRange.map((b) => b.weight));
    const weightSpan = hi - lo;
    const step = weightSpan <= 2600 ? 250 : weightSpan <= 5200 ? 500 : 1000;
    const yMin = Math.max(0, Math.floor(lo / step) * step - step);
    const yMax = Math.ceil(hi / step) * step + step;
    const yTicks: number[] = [];
    for (let y = yMin; y <= yMax; y += step) yTicks.push(y);

    const data = [
      ...rows,
      ...inRange.map((b) => ({ age: b.age, weight: b.weight })),
    ].sort((a, b) => (a.age as number) - (b.age as number));

    return { data, xTicks, xLabel, yTicks, yMin, yMax };
  }, [sex, baby, view]);

  if (!open) return null;

  const curveColour = CURVE_COLOUR[sex];

  // Direct-label each centile curve at its right end, like the printed chart.
  // The final data row is always a curve row (curves span the whole view).
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
              Growth chart · UK-WHO centiles ({sex})
            </h2>
            <p className="truncate text-xs text-muted">
              Latest {formatKg(latest.weight)} · {centileLabel(latestPct)} ·
              pinch or scroll to zoom, drag to pan, double-tap to reset
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

        <div
          ref={wrapRef}
          className="min-h-0 flex-1 px-1 py-2"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={() => setView(DEFAULT_VIEW)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 14, right: 10, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="0" />
              <XAxis
                dataKey="age"
                type="number"
                domain={[view.min, view.max]}
                ticks={xTicks}
                tickFormatter={xLabel}
                allowDataOverflow
                stroke="var(--faint)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                label={{
                  value: view.max - view.min <= 400 ? "age (weeks)" : "age (months)",
                  position: "insideBottomRight",
                  fontSize: 10,
                  fill: "var(--faint)",
                  dy: -2,
                }}
              />
              <YAxis
                domain={[yMin, yMax]}
                ticks={yTicks}
                tickFormatter={(g: number) =>
                  g % 1000 === 0 ? `${g / 1000}kg` : `${(g / 1000).toFixed(2)}`
                }
                allowDataOverflow
                stroke="var(--faint)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
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
          The nine UK-WHO centiles (WHO weight-for-age, {sex}s 0–24 months).
          Term babies (37–42 weeks) are plotted from birth with no gestational
          correction. A guide for parents — your red book chart, plotted by
          your midwife or health visitor, remains the clinical reference.
        </p>
      </div>
    </Portal>
  );
}
