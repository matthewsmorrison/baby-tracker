"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { weightBand } from "@/lib/clinical";
import { dayWithDate } from "@/lib/dates";
import type { BabySex } from "@/lib/types";

export interface WeightPoint {
  day: number; // fractional day of life
  weight: number;
}

/**
 * A deliberately simple weight chart: a shaded "healthy range" band and the
 * baby's own line. No extra reference lines or danger zones — the aim is a
 * glance-answer to "is it in range and trending up?".
 */
export function WeightChart({
  points,
  birthWeightG,
  maxDay,
  birthAt,
  sex,
}: {
  points: WeightPoint[];
  birthWeightG: number;
  maxDay: number;
  birthAt?: string;
  sex?: BabySex | null;
}) {
  const lastDay = Math.max(maxDay, 14);

  const data: Array<{ day: number; band?: [number, number]; weight?: number }> =
    [];
  for (let d = 1; d <= lastDay; d += 0.5) {
    const band = weightBand(d, birthWeightG, sex ?? null);
    data.push({ day: d, band: [band.low, band.high] });
  }
  for (const p of points) data.push({ day: p.day, weight: p.weight });
  data.sort((a, b) => a.day - b.day);

  const weights = points.map((p) => p.weight);
  const tenPctLine = Math.round(birthWeightG * 0.9);
  const bandVals = data.flatMap((d) => d.band ?? []);
  const yMin =
    Math.floor(
      Math.min(tenPctLine, ...bandVals, ...(weights.length ? weights : [birthWeightG])) /
        200
    ) * 200;
  const yMax =
    Math.ceil(
      Math.max(birthWeightG, ...bandVals, ...(weights.length ? weights : [birthWeightG])) /
        200
    ) * 200;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="day"
            type="number"
            domain={[1, lastDay]}
            tickCount={Math.min(lastDay, 8)}
            tickFormatter={(d: number) => `D${Math.round(d)}`}
            stroke="var(--faint)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(g: number) => `${(g / 1000).toFixed(1)}kg`}
            stroke="var(--faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "weight")
                return [`${((value as number) / 1000).toFixed(3)} kg`, "Weight"];
              if (Array.isArray(value))
                return [
                  `${(value[0] / 1000).toFixed(1)}–${(value[1] / 1000).toFixed(1)} kg`,
                  "Healthy range",
                ];
              return [String(value), String(name)];
            }}
            labelFormatter={(d) =>
              birthAt
                ? dayWithDate(birthAt, Math.round(Number(d)))
                : `Day ${Math.round(Number(d))}`
            }
            contentStyle={{
              borderRadius: 16,
              border: "1px solid var(--line)",
              boxShadow: "0 10px 30px rgba(0,0,0,.08)",
              fontSize: 12,
              background: "var(--surface)",
            }}
          />
          {/* Healthy range */}
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--positive-bg)"
            fillOpacity={0.9}
            connectNulls
            isAnimationActive={false}
          />
          {/* Birth weight */}
          <ReferenceLine
            y={birthWeightG}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{
              value: "birth",
              position: "insideTopRight",
              fill: "var(--muted)",
              fontSize: 10,
            }}
          />
          {/* −10% of birth weight: seek advice */}
          <ReferenceLine
            y={tenPctLine}
            stroke="var(--alert)"
            strokeDasharray="4 4"
            label={{
              value: "−10%",
              position: "insideBottomRight",
              fill: "var(--alert)",
              fontSize: 10,
            }}
          />
          {/* The baby's weights */}
          <Line
            dataKey="weight"
            stroke="var(--ink)"
            strokeWidth={2.5}
            connectNulls
            dot={{ r: 4, fill: "var(--ink)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
