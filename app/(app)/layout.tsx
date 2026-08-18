import { after } from "next/server";
import { getBabyContext, getRecentEntries } from "@/lib/data";
import { touchPresence } from "@/lib/presenceServer";
import { dayOfLife } from "@/lib/clinical";
import { Nav } from "@/components/shell/Nav";
import { BottomBar } from "@/components/shell/BottomBar";
import { Header } from "@/components/shell/Header";
import { TimerIndicator } from "@/components/log/TimerIndicator";
import { LogModal } from "@/components/log/LogModal";
import { PresencePublisher } from "@/components/friends/PresencePublisher";
import { RefreshOnResume } from "@/components/shell/RefreshOnResume";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getBabyContext();

  // Server-side presence touch, after the response: any page load counts as
  // "has the app open". The client heartbeat keeps it alive while idling on
  // one screen, but this path works even where client JS misbehaves (PWAs).
  after(() => touchPresence(ctx.userId));

  const day = dayOfLife(ctx.baby.birth_at, new Date());
  const aiEnabled = ctx.baby.membership_tier === "advanced";
  // Recent entries only: the forms' defaults and the ?edit= deep link rarely
  // reach further back, and this array is serialised into every page's
  // payload — the full history here is what made cold loads crawl. LogModal
  // fetches older edit targets by id itself.
  const entries = ctx.canEdit ? await getRecentEntries(ctx.baby.id) : [];

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-6 sticky top-0 h-dvh">
        <Header
          babyName={ctx.baby.name}
          day={day}
          babies={ctx.babies.map((b) => ({
            id: b.baby.id,
            name: b.baby.name,
          }))}
          activeBabyId={ctx.baby.id}
          role={ctx.role}
          aiEnabled={aiEnabled}
        />
        <Nav canEdit={ctx.canEdit} orientation="side" aiEnabled={aiEnabled} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur px-4 py-3">
          <Header
            babyName={ctx.baby.name}
            day={day}
            babies={ctx.babies.map((b) => ({
              id: b.baby.id,
              name: b.baby.name,
            }))}
            activeBabyId={ctx.baby.id}
            role={ctx.role}
            aiEnabled={aiEnabled}
            compact
          />
        </div>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom bar (portaled to body so it stays viewport-fixed) */}
      <BottomBar canEdit={ctx.canEdit} aiEnabled={aiEnabled} />

      <RefreshOnResume />
      <PresencePublisher userId={ctx.userId} babyId={ctx.baby.id} />
      {ctx.canEdit && <TimerIndicator babyId={ctx.baby.id} />}
      {ctx.canEdit && (
        <LogModal
          babyId={ctx.baby.id}
          birthAt={ctx.baby.birth_at}
          entries={entries}
          nappyBaseWeightG={ctx.baby.nappy_base_weight_g}
          trackedTypes={ctx.baby.tracked_types}
          advanced={aiEnabled}
        />
      )}
    </div>
  );
}
