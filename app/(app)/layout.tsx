import { getBabyContext } from "@/lib/data";
import { dayOfLife } from "@/lib/clinical";
import { Nav } from "@/components/shell/Nav";
import { Header } from "@/components/shell/Header";
import { TimerIndicator } from "@/components/log/TimerIndicator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getBabyContext();
  const day = dayOfLife(ctx.baby.birth_at, new Date());

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
        />
        <Nav canEdit={ctx.canEdit} orientation="side" />
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
            compact
          />
        </div>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <Nav canEdit={ctx.canEdit} orientation="bottom" />
      </div>

      {ctx.canEdit && <TimerIndicator babyId={ctx.baby.id} />}
    </div>
  );
}
