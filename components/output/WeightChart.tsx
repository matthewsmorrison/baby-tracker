"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
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
  const who = !!sex;
  const lastDay = Math.max(maxDay, 14);

  // Band + midline sampled per half-day; actual weights merged onto the same
  // x axis so recharts can draw both series together.
  const data: Array<{
    day: number;
    band?: [number, number];
    mid?: number;
    weight?: number;
  }> = [];
  for (let d = 1; d <= lastDay; d += 0.5) {
    const band = weightBand(d, birthWeightG, sex ?? null);
    data.push({ day: d, band: [band.low, band.high], mid: band.mid });
  }
  for (const p of points) {
    data.push({ day: p.day, weight: p.weight });
  }
  data.sort((a, b) => a.day - b.day);

  const weights = points.map((p) => p.weight);
  const tenPctLine = Math.round(birthWeightG * 0.9);
  const bandVals = data.flatMap((d) => d.band ?? []);
  const yMin =
    Math.floor(
      Math.min(
        birthWeightG * 0.88, // keep the -10% danger line inside the plot
        ...bandVals,
        ...(weights.length ? weights : [birthWeightG])
      ) / 100
    ) *
      100 -
    100;
  const yMax =
    Math.ceil(
      Math.max(...bandVals, ...(weights.length ? weights : [birthWeightG])) / 100
    ) *
      100 +
    100;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="day"
            type="number"
            domain={[1, lastDay]}
            tickCount={Math.min(lastDay, 14)}
            tickFormatter={(d: number) => `d${Math.round(d)}`}
            stroke="var(--faint)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(g: number) => `${(g / 1000).toFixed(1)}`}
            stroke="var(--faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "weight") return [`${value} g`, "Weight"];
              if (name === "mid")
                return [`${value} g`, who ? "50th centile" : "Expected"];
              if (Array.isArray(value))
                return [
                  `${value[0]}–${value[1]} g`,
                  who ? "2nd–98th centile" : "Expected range",
                ];
              return [String(value), String(name)];
            }}
            labelFormatter={(d) =>
              birthAt
                ? dayWithDate(birthAt, Math.round(Number(d)))
                : `Day ${Math.round(Number(d) * 10) / 10}`
            }
            contentStyle={{
              borderRadius: 16,
              border: "1px solid var(--line)",
              boxShadow: "0 10px 30px rgba(0,0,0,.08)",
              fontSize: 12,
            }}
          />
          {/* Below −10% of birth weight: seek advice. Zone + line, not colour alone. */}
          <ReferenceArea
            y1={yMin}
            y2={tenPctLine}
            fill="var(--alert-bg)"
            fillOpacity={0.6}
            stroke="none"
          />
          <ReferenceLine
            y={tenPctLine}
            stroke="var(--alert)"
            strokeDasharray="4 4"
            label={{
              value: "−10% — seek advice",
              position: "insideBottomLeft",
              fill: "var(--alert)",
              fontSize: 10,
            }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--positive-bg)"
            fillOpacity={0.8}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="mid"
            stroke="var(--positive-bar)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <ReferenceLine
            y={birthWeightG}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{
              value: "birth",
              position: "insideTopRight",
              fill: "var(--muted)",
              fontSize: 11,
            }}
          />
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
