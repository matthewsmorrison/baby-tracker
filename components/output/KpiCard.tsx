import { Card } from "@/components/ui/Card";

export function KpiCard({
  label,
  value,
  target,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  target?: string;
  tone?: "neutral" | "positive" | "watch" | "alert";
  sub?: string;
}) {
  const toneCls = {
    neutral: "text-ink",
    positive: "text-positive",
    watch: "text-watch",
    alert: "text-alert",
  }[tone];

  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`stat-num mt-1 text-2xl ${toneCls}`}>
        {value}
        {target && (
          <span className="ml-1.5 text-sm font-medium text-faint">
            / {target}
          </span>
        )}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}
