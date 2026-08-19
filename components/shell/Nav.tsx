"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Clock, Settings, ChartColumn, Sparkles, NotebookPen, Users } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/legal";
import { UnreadBadge } from "@/components/friends/UnreadBadge";

const items = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/dashboard", label: "Charts", icon: ChartColumn },
  { href: "/history", label: "History", icon: Clock },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/friends", label: "Friends", icon: Users },
  // Mobile reaches Ask via the header sparkle. Advanced membership only.
  { href: "/chat", label: `Ask ${ASSISTANT_NAME}`, icon: Sparkles, sideOnly: true, ai: true },
  { href: "/profile", label: "Settings", icon: Settings },
];

/** Inner content of a nav link. Lives inside the <Link> so useLinkStatus can
 *  pulse the tapped tab while its navigation is pending — the first tap
 *  always gives visible feedback, even mid-load. */
function NavContent({
  href,
  label,
  icon: Icon,
  active,
  orientation,
}: {
  href: string;
  label: string;
  icon: (typeof items)[number]["icon"];
  active: boolean;
  orientation: "side" | "bottom";
}) {
  const { pending } = useLinkStatus();
  const pulse = pending && !active ? "animate-pulse" : "";
  return (
    <>
      <span className={`relative ${pulse}`}>
        <Icon
          className={orientation === "side" ? "h-4 w-4" : "h-5 w-5"}
          strokeWidth={orientation === "side" ? 2.2 : active ? 2.4 : 2}
        />
        {href === "/friends" && <UnreadBadge orientation={orientation} />}
      </span>
      <span className={pulse}>{label}</span>
    </>
  );
}

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
        {visible.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-ink text-on-ink"
                  : "text-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              <NavContent
                href={href}
                label={label}
                icon={icon}
                active={active}
                orientation="side"
              />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex items-stretch justify-around px-2 py-1.5">
      {visible.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            // Six always-visible links would otherwise fire six full dynamic
            // RSC prefetches right at load, competing with hydration; the
            // router cache (staleTimes) keeps taps fast after first visit.
            prefetch={false}
            className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition ${
              active ? "text-ink" : "text-faint hover:text-muted"
            }`}
          >
            <NavContent
              href={href}
              label={label}
              icon={icon}
              active={active}
              orientation="bottom"
            />
          </Link>
        );
      })}
    </nav>
  );
}
