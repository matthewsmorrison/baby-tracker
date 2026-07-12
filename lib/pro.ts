import "server-only";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import type { Professional } from "./types";

/**
 * The professional profile for the signed-in user, if any. If a profile has
 * their email but isn't linked yet, it's claimed (user_id set) on first sign
 * in. Uses the service role because professionals has no user-write policy.
 */
export async function getProfessionalForUser(): Promise<Professional | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();

  const { data: linked } = await svc
    .from("professionals")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (linked) return linked as Professional;

  if (user.email) {
    const { data: match } = await svc
      .from("professionals")
      .select("*")
      .ilike("email", user.email)
      .is("user_id", null)
      .maybeSingle();
    if (match) {
      await svc
        .from("professionals")
        .update({ user_id: user.id })
        .eq("id", match.id);
      return { ...(match as Professional), user_id: user.id };
    }
  }
  return null;
}
