"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Clock, UserRound, ChartColumn, Sparkles } from "lucide-react";

const items = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/dashboard", label: "Charts", icon: ChartColumn },
  { href: "/history", label: "History", icon: Clock },
  // Mobile reaches Ask via the header sparkle. Advanced membership only.
  { href: "/chat", label: "Ask", icon: Sparkles, sideOnly: true, ai: true },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function Nav({
  orientation,
  aiEnabled,
}: {
  canEdit: boolean;
  orientation: "side" | "bottom";
  aiEnabled: boolean;
}) {
  const pathname = usePathname();
  const visible = items.filter(
    (i) =>
      (orientation === "side" || !i.sideOnly) && (aiEnabled || !i.ai)
  );

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

  return (
    <nav className="flex items-stretch justify-around px-2 py-1.5">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
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
