"use client";

import Link from "next/link";
import { Flame, ChevronDown, Eye, Sparkles } from "lucide-react";
import { setActiveBaby } from "@/lib/actions";
import type { MemberRole } from "@/lib/types";

export function Header({
  babyName,
  day,
  babies,
  activeBabyId,
  role,
  compact = false,
}: {
  babyName: string;
  day: number;
  babies: Array<{ id: string; name: string }>;
  activeBabyId: string;
  role: MemberRole;
  compact?: boolean;
}) {
  const switcher =
    babies.length > 1 ? (
      <div className="relative">
        <select
          aria-label="Switch baby"
          className="appearance-none rounded-full border border-line bg-surface px-3 py-1 pr-7 text-sm font-medium"
          value={activeBabyId}
          onChange={(e) => setActiveBaby(e.target.value)}
        >
          {babies.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      </div>
    ) : null;

  return (
    <div
      className={
        compact ? "flex items-center justify-between" : "flex flex-col gap-3"
      }
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft">
          <Flame className="h-4 w-4 text-accent" strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">{babyName}</p>
          <p className="text-xs text-muted leading-tight">
            Day {day} ·{" "}
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {role === "viewer" && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-faint">
                <Eye className="h-3 w-3" /> read-only
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {compact && (
          <Link
            href="/chat"
            aria-label="Ask about the data"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-accent"
          >
            <Sparkles className="h-4 w-4" />
          </Link>
        )}
        {switcher}
      </div>
    </div>
  );
}
