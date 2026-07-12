import { getBabyContext, getEntries } from "@/lib/data";
import { dayOfLife } from "@/lib/clinical";
import { feedAmounts } from "@/lib/entryDisplay";

export const runtime = "nodejs";

function esc(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Download all of a baby's entries as CSV (data portability).
export async function GET(request: Request) {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);
  const url = new URL(request.url);
  const tz = url.searchParams.get("tz") || "UTC";

  const local = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: tz, ...opts });

  const header = [
    "date",
    "time",
    "day_of_life",
    "type",
    "wet",
    "dirty",
    "stool_colour",
    "left_min",
    "right_min",
    "expressed_ml",
    "formula_ml",
    "weight_g",
    "length_cm",
    "head_cm",
    "temp_c",
    "milestone",
    "sleep_location",
    "settle_method",
    "spit_up",
    "post_feed_mood",
    "medication",
    "ended",
    "duration_min",
    "note",
  ];

  const rows = [...entries]
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    .map((e) => {
      const a = e.type === "feed" ? feedAmounts(e) : null;
      const durMin =
        e.ended_at
          ? Math.round(
              (new Date(e.ended_at).getTime() -
                new Date(e.occurred_at).getTime()) /
                60000
            )
          : "";
      return [
        local(e.occurred_at, { day: "2-digit", month: "2-digit", year: "numeric" }),
        local(e.occurred_at, { hour: "2-digit", minute: "2-digit" }),
        dayOfLife(ctx.baby.birth_at, e.occurred_at),
        e.type,
        e.wet ? "yes" : "",
        e.dirty ? "yes" : "",
        e.stool_colour ?? "",
        a?.left || "",
        a?.right || "",
        a?.expressed || "",
        a?.formula || "",
        e.weight_g ?? "",
        e.length_mm ? (e.length_mm / 10).toFixed(1) : "",
        e.head_circ_mm ? (e.head_circ_mm / 10).toFixed(1) : "",
        e.temp_c ?? "",
        e.milestone_label ?? "",
        e.sleep_location ?? "",
        e.settle_method ?? "",
        e.spit_up ? "yes" : "",
        e.post_feed_mood ?? "",
        e.med_name
          ? `${e.med_name}${e.med_subject === "baby" ? " (baby)" : ""}`
          : "",
        e.ended_at ? local(e.ended_at, { hour: "2-digit", minute: "2-digit" }) : "",
        durMin,
        e.note ?? "",
      ]
        .map(esc)
        .join(",");
    });

  const csv = [header.join(","), ...rows].join("\n");
  const safeName = ctx.baby.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
