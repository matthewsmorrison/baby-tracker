"use client";

import { useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Link2, Mail } from "lucide-react";

const PROVIDER_LABEL: Record<string, string> = {
  email: "Email (magic link)",
  google: "Google",
};

/** A little Google "G" so the row is recognisable without a brand asset. */
function GoogleMark() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-bold text-[#4285F4]">
      G
    </span>
  );
}

export function ConnectedAccounts() {
  const supabase = useState(() => createClient())[0];
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!alive) return;
      if (error) setError(error.message);
      else setIdentities(data?.identities ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const hasGoogle = identities?.some((i) => i.provider === "google");

  async function linkGoogle() {
    setError(null);
    setBusy("google");
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          "/profile"
        )}`,
      },
    });
    // On success the browser redirects to Google; only errors return here.
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  async function unlink(identity: UserIdentity) {
    if (!identities || identities.length <= 1) return;
    setError(null);
    setBusy(identity.provider);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      setError(error.message);
    } else {
      setIdentities((list) =>
        (list ?? []).filter((i) => i.identity_id !== identity.identity_id)
      );
    }
    setBusy(null);
  }

  return (
    <Card className="p-5">
      <CardTitle>Sign-in methods</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Link more than one way to sign in to this account — handy if you use
        Google on one device and email on another.
      </p>

      {identities === null ? (
        <p className="mt-3 text-sm text-faint">Loading…</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {identities.map((i) => (
            <li key={i.identity_id} className="flex items-center gap-3 py-3">
              {i.provider === "google" ? (
                <GoogleMark />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt text-muted">
                  <Mail className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {PROVIDER_LABEL[i.provider] ?? i.provider}
                </p>
                {i.identity_data?.email && (
                  <p className="truncate text-xs text-muted">
                    {i.identity_data.email}
                  </p>
                )}
              </div>
              {identities.length > 1 && (
                <button
                  type="button"
                  disabled={busy === i.provider}
                  onClick={() => unlink(i)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-alert-bg hover:text-alert disabled:opacity-50"
                >
                  {busy === i.provider ? "Removing…" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {identities !== null && !hasGoogle && (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={busy === "google"}
          onClick={linkGoogle}
        >
          <Link2 className="h-4 w-4" />
          {busy === "google" ? "Redirecting…" : "Link Google account"}
        </Button>
      )}

      {error && <p className="mt-3 text-sm text-alert">{error}</p>}
    </Card>
  );
}
