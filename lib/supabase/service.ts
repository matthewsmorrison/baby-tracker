import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Secret-key client — bypasses RLS. Server-side only; used by the analyze
// route (reading private photos) and invite acceptance. Never import this
// from client code.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
