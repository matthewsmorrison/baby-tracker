"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Flame } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Same-origin paths only: "//evil.com" and "/\evil.com" are protocol-
  // relative URLs to the browser, so a bare startsWith("/") is an open
  // redirect.
  const rawNext = searchParams.get("next") ?? "/today";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/today";
  const [error, setError] = useState<string | null>(null);
  const oauthCode = searchParams.get("code");

  // Self-heal: if an OAuth `code` lands here (e.g. Supabase fell back to the
  // Site URL), complete the exchange in the browser that started the flow —
  // it still holds the PKCE verifier — and continue to the app.
  useEffect(() => {
    if (!oauthCode) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(oauthCode);
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        router.replace(next);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oauthCode, next, router]);

  // While completing an OAuth redirect, show a spinner instead of the form.
  if (oauthCode && !error) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-muted">Signing you in…</p>
      </main>
    );
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <Flame className="h-7 w-7 text-accent" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">beanlo</h1>
          <p className="mt-2 text-sm text-muted">
            Nappies, feeds and weight for the first days and weeks
          </p>
        </div>

        <Card className="p-6">
          <p className="mb-4 text-center text-sm text-muted">
            Sign in or create your account with Google.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={signInWithGoogle}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>

          {error && (
            <p className="mt-4 rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">
              {error}
            </p>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-faint">
          A tracking aid, not medical advice or diagnosis.
        </p>
        <p className="mt-2 text-center text-xs text-faint">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
