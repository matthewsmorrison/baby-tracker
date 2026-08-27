import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/invite",
  "/guides",
  "/privacy",
  "/terms",
  "/cookies",
  "/disclaimer",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/api/cron", // secret-authenticated; must not redirect to /login
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // "/" is the public landing (exact match — startsWith "/" would match all).
  // Match a prefix only at a path boundary so a public prefix can't also
  // match a longer private path.
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // The app trusts x-user-id downstream, so a client-supplied value must
  // never survive — sanitise unconditionally, before any early return.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");

  // The iOS app authenticates API calls with a Bearer token, which each
  // route verifies itself (getRouteAuth). Redirecting an API request to the
  // login page hands HTML to a JSON/stream client — never do that: pass
  // Bearer requests through, and 401 any other unauthenticated API call.
  const isApi = pathname.startsWith("/api/");
  if (isApi && request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  // Public page, nobody signed in: nothing to verify, don't pay for auth.
  // (/login with a session still needs the check below to bounce to /today.)
  if (isPublic && !hasAuthCookie) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  // No session cookie on a private path: straight to login, zero round trips.
  if (!isPublic && !hasAuthCookie) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Keep the forwarded header set in sync with the mutated cookies.
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims verifies the JWT locally (no network) once the project uses
  // asymmetric signing keys, and still refreshes an expired session the same
  // way getUser() did. Do not run code between createServerClient and this
  // call — it can cause random logouts.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  if (!userId && !isPublic) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (userId) {
    // Forward the verified identity so server components don't have to ask
    // Supabase "who is this?" a second time on every render.
    requestHeaders.set("x-user-id", userId);
    const withIdentity = NextResponse.next({
      request: { headers: requestHeaders },
    });
    // Preserve any refreshed session cookies set during getClaims().
    response.cookies
      .getAll()
      .forEach((c) => withIdentity.cookies.set(c));
    response = withIdentity;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
