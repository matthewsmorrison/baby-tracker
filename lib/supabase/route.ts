import "server-only";
import { createClient as createSupabase, SupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

/**
 * Auth for API routes that serve both the web app (cookie session) and the
 * native iOS app (Authorization: Bearer <access token>). Returns an
 * RLS-scoped client either way — bearer tokens are verified with getClaims
 * (local JWT verification against the project's signing keys).
 */
export async function getRouteAuth(
  request: Request
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const jwt = header.slice(7);
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: header } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data, error } = await supabase.auth.getClaims(jwt);
    const userId = data?.claims?.sub;
    if (error || !userId) return null;
    return { supabase, userId };
  }

  const supabase = await createCookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}
