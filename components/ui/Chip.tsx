import type { HTMLAttributes } from "react";

export function Chip({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "alert" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-alt text-muted border border-line",
    positive: "bg-positive-bg text-positive",
    alert: "bg-alert-bg text-alert",
    accent: "bg-accent-soft text-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
