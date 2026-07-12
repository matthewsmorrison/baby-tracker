import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Remembers which professional referred a family, then sends them to sign in.
// createBaby reads this cookie to attribute the new baby. The value is the
// professional's id; expires in 30 days.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const { data: pro } = await supabase
    .from("professionals")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const res = NextResponse.redirect(`${origin}/login`);
  if (pro?.id) {
    res.cookies.set("beanlo_ref", pro.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return res;
}
