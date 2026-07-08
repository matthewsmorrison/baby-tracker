import { getBabyContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { BabyNote, Profile } from "@/lib/types";
import { NotesClient, type TagMember } from "@/components/notes/NotesClient";

export default async function NotesPage() {
  const ctx = await getBabyContext();
  const supabase = await createClient();

  const { data: notes } = await supabase
    .from("baby_notes")
    .select("*")
    .eq("baby_id", ctx.baby.id)
    .order("created_at", { ascending: false });

  // People you can tag: everyone with access to this baby.
  const { data: members } = await supabase
    .from("baby_members")
    .select("user_id, role")
    .eq("baby_id", ctx.baby.id);
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));

  const tagMembers: TagMember[] = (members ?? []).map((m) => {
    const p = profileMap.get(m.user_id);
    return {
      userId: m.user_id,
      name: p?.full_name || p?.email || "Carer",
      role: m.role,
      isSelf: m.user_id === ctx.userId,
    };
  });

  return (
    <NotesClient
      babyId={ctx.baby.id}
      canEdit={ctx.canEdit}
      currentUserId={ctx.userId}
      notes={(notes ?? []) as BabyNote[]}
      members={tagMembers}
    />
  );
}
