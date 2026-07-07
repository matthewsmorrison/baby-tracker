import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import type { Baby, Entry, MemberRole } from "./types";

export interface BabyContext {
  baby: Baby;
  role: MemberRole;
  canEdit: boolean;
  isOwner: boolean;
  babies: Array<{ baby: Baby; role: MemberRole }>;
  userId: string;
}

const ACTIVE_BABY_COOKIE = "hearth_active_baby";

/**
 * Resolve the signed-in user and their active baby (cookie-selected, else
 * first). Redirects to /login or /onboarding when either is missing.
 */
export async function getBabyContext(): Promise<BabyContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("baby_members")
    .select("role, baby:babies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const babies = (memberships ?? [])
    .filter((m) => m.baby)
    .map((m) => ({
      baby: m.baby as unknown as Baby,
      role: m.role as MemberRole,
    }));

  if (babies.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BABY_COOKIE)?.value;
  const active = babies.find((b) => b.baby.id === activeId) ?? babies[0];

  return {
    baby: active.baby,
    role: active.role,
    canEdit: active.role === "owner" || active.role === "caregiver",
    isOwner: active.role === "owner",
    babies,
    userId: user.id,
  };
}

/** All entries for a baby, newest first. */
export async function getEntries(babyId: string): Promise<Entry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Entry[];
}

export { ACTIVE_BABY_COOKIE };
