import { getBabyContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dayOfLife } from "@/lib/clinical";
import { dayWithDate } from "@/lib/dates";
import type { BabyInvite, BabyMember, Profile } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PushToggle } from "@/components/notifications/PushToggle";
import { ExportCard } from "@/components/export/ExportButtons";
import { TrackingToggles } from "@/components/profile/TrackingToggles";
import { ThemeToggle } from "@/components/profile/ThemeToggle";
import { ConnectedAccounts } from "@/components/profile/ConnectedAccounts";
import { MedicationManager } from "@/components/profile/MedicationManager";
import {
  BabySettings,
  DangerZone,
  InviteSection,
  MemberRow,
  LeaveOrSignOut,
} from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const ctx = await getBabyContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("baby_members")
    .select("*")
    .eq("baby_id", ctx.baby.id)
    .order("created_at", { ascending: true });

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));

  let invites: BabyInvite[] = [];
  if (ctx.isOwner) {
    const { data } = await supabase
      .from("baby_invites")
      .select("*")
      .eq("baby_id", ctx.baby.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    invites = (data ?? []) as BabyInvite[];
  }

  const day = dayOfLife(ctx.baby.birth_at, new Date());
  const myMembership = (members ?? []).find((m) => m.user_id === ctx.userId);

  return (
    <div className="space-y-4 animate-rise">
      {/* Baby card */}
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold tracking-tight">{ctx.baby.name}</h1>
          <Chip tone="accent">{dayWithDate(ctx.baby.birth_at, day)}</Chip>
        </div>
        <BabySettings baby={ctx.baby} canEdit={ctx.isOwner} />
      </Card>

      {ctx.isOwner && (
        <TrackingToggles
          babyId={ctx.baby.id}
          tracked={ctx.baby.tracked_types}
        />
      )}

      {/* Members */}
      <Card className="p-5">
        <CardTitle className="mb-1">Carers &amp; access</CardTitle>
        <p className="mb-3 text-xs text-faint">
          Your role:{" "}
          {ctx.role === "viewer" ? "healthcare professional (read-only)" : ctx.role}
        </p>
        <ul className="divide-y divide-line">
          {(members ?? []).map((m: BabyMember) => (
            <MemberRow
              key={m.id}
              member={m}
              profile={profileMap.get(m.user_id) ?? null}
              isSelf={m.user_id === ctx.userId}
              canManage={ctx.isOwner}
            />
          ))}
        </ul>
        {ctx.isOwner && <InviteSection babyId={ctx.baby.id} invites={invites} />}
      </Card>

      {ctx.canEdit && <PushToggle />}

      <MedicationManager babyId={ctx.baby.id} canEdit={ctx.canEdit} />

      <ThemeToggle />

      <ConnectedAccounts />

      {/* Membership tier */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Membership</CardTitle>
            {ctx.baby.membership_tier === "advanced" ? (
              <p className="mt-1 text-sm">
                <span className="font-semibold">Advanced</span> — everything in
                Free, plus AI photo labelling and Ask
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Free</span> — tracking,
                  charts, calendar &amp; carer sharing
                </p>
                <p className="text-xs text-faint mt-0.5">
                  Advanced adds AI photo labelling and the Ask chat — upgrades
                  coming soon.
                </p>
              </>
            )}
          </div>
          <Chip tone={ctx.baby.membership_tier === "advanced" ? "positive" : "accent"}>
            {ctx.baby.membership_tier === "advanced" ? "Advanced" : "Free"}
          </Chip>
        </div>
      </Card>

      <ExportCard />

      <DangerZone
        babyId={ctx.baby.id}
        babyName={ctx.baby.name}
        isOwner={ctx.isOwner}
      />

      <LeaveOrSignOut
        membershipId={myMembership?.id ?? null}
        isOwner={ctx.isOwner}
        babyName={ctx.baby.name}
      />

      <p className="px-2 pb-2 text-center text-xs text-faint">
        Hearth is a tracking aid, not medical advice or diagnosis.
      </p>
    </div>
  );
}
