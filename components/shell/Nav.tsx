"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  PenLine,
  Clock,
  UserRound,
  ChartColumn,
  CalendarDays,
} from "lucide-react";

const items = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/dashboard", label: "Charts", icon: ChartColumn },
  { href: "/log", label: "Log", icon: PenLine, input: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/history", label: "History", icon: Clock },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function Nav({
  canEdit,
  orientation,
}: {
  canEdit: boolean;
  orientation: "side" | "bottom";
}) {
  const pathname = usePathname();
  const visible = items.filter((i) => canEdit || !i.input);

  if (orientation === "side") {
    return (
      <nav className="mt-8 flex flex-col gap-1">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  // Bottom bar: Log is the emphasised centre action
  return (
    <nav className="flex items-stretch justify-around px-2 py-1.5">
      {visible.map(({ href, label, icon: Icon, input }) => {
        const active = pathname.startsWith(href);
        if (input) {
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <span
                className={`flex h-13 w-13 items-center justify-center rounded-full shadow-card transition ${
                  active ? "bg-ink text-white" : "bg-ink text-white"
                }`}
                style={{ height: 52, width: 52 }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-muted">
                {label}
              </span>
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition ${
              active ? "text-ink" : "text-faint hover:text-muted"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
