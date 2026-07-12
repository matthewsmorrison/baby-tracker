import { NextResponse } from "next/server";

// Remembers that this person is signing up as a professional, then sends them
// to sign in. Onboarding reads the cookie to default to the professional form.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const res = NextResponse.redirect(`${origin}/login`);
  res.cookies.set("beanlo_role", "pro", {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
