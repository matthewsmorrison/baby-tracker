import { getBabyContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dayOfLife, formatKg } from "@/lib/clinical";
import { dayWithDate } from "@/lib/dates";
import type { BabyInvite, BabyMember, Profile } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import {
  EditBirthDetails,
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
          <div>
            <h1 className="text-xl font-bold tracking-tight">{ctx.baby.name}</h1>
            <p className="mt-1 text-sm text-muted">
              Born{" "}
              {new Date(ctx.baby.birth_at).toLocaleString(undefined, {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {formatKg(ctx.baby.birth_weight_g)}
            </p>
          </div>
          <Chip tone="accent">{dayWithDate(ctx.baby.birth_at, day)}</Chip>
        </div>
        {ctx.isOwner && <EditBirthDetails baby={ctx.baby} />}
      </Card>

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

      {/* Membership tier */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Membership</CardTitle>
            <p className="mt-1 text-sm">
              <span className="font-semibold">Free</span> — tracking, weight
              chart &amp; carer sharing
            </p>
            <p className="text-xs text-faint mt-0.5">
              AI photo checks included while in beta.
            </p>
          </div>
          <Chip tone="accent">Beta</Chip>
        </div>
      </Card>

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
