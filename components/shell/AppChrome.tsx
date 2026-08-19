import { after } from "next/server";
import { getBabyContext } from "@/lib/data";
import { touchPresence } from "@/lib/presenceServer";
import { dayOfLife } from "@/lib/clinical";
import { Header } from "./Header";
import { Nav } from "./Nav";
import { BottomBar } from "./BottomBar";
import { TimerIndicator } from "@/components/log/TimerIndicator";
import { LogModal } from "@/components/log/LogModal";
import { PresencePublisher } from "@/components/friends/PresencePublisher";

// The layout's data-dependent chrome, split out so the layout itself is
// synchronous: each of these streams in behind its own Suspense boundary
// instead of blocking the first byte. getBabyContext() is request-memoised,
// so the three chrome pieces and the page share one lookup.

export async function SideChrome() {
  const ctx = await getBabyContext();
  const day = dayOfLife(ctx.baby.birth_at, new Date());
  const aiEnabled = ctx.baby.membership_tier === "advanced";
  return (
    <>
      <Header
        babyName={ctx.baby.name}
        day={day}
        babies={ctx.babies.map((b) => ({ id: b.baby.id, name: b.baby.name }))}
        activeBabyId={ctx.baby.id}
        role={ctx.role}
        aiEnabled={aiEnabled}
      />
      <Nav canEdit={ctx.canEdit} orientation="side" aiEnabled={aiEnabled} />
    </>
  );
}

export async function MobileHeaderChrome() {
  const ctx = await getBabyContext();
  const day = dayOfLife(ctx.baby.birth_at, new Date());
  return (
    <Header
      babyName={ctx.baby.name}
      day={day}
      babies={ctx.babies.map((b) => ({ id: b.baby.id, name: b.baby.name }))}
      activeBabyId={ctx.baby.id}
      role={ctx.role}
      aiEnabled={ctx.baby.membership_tier === "advanced"}
      compact
    />
  );
}

export async function FloatingChrome() {
  const ctx = await getBabyContext();
  const aiEnabled = ctx.baby.membership_tier === "advanced";

  // Server-side presence touch, after the response: any page load counts as
  // "has the app open". The client heartbeat keeps it alive while idling on
  // one screen, but this path works even where client JS misbehaves (PWAs).
  after(() => touchPresence(ctx.userId));

  return (
    <>
      <BottomBar canEdit={ctx.canEdit} aiEnabled={aiEnabled} />
      <PresencePublisher userId={ctx.userId} babyId={ctx.baby.id} />
      {ctx.canEdit && <TimerIndicator babyId={ctx.baby.id} />}
      {ctx.canEdit && (
        <LogModal
          babyId={ctx.baby.id}
          birthAt={ctx.baby.birth_at}
          nappyBaseWeightG={ctx.baby.nappy_base_weight_g}
          trackedTypes={ctx.baby.tracked_types}
          advanced={aiEnabled}
        />
      )}
    </>
  );
}
