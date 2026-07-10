import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { acceptInvite } from "@/lib/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flame } from "lucide-react";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look the invite up with the service role so we can show the baby's name
  // before the user is signed in / a member. Read-only; acceptance re-verifies.
  const service = createServiceClient();
  const { data: invite } = await service
    .from("baby_invites")
    .select("id, email, role, status, babies(name)")
    .eq("token", token)
    .single();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const babyName =
    (invite?.babies as unknown as { name: string } | null)?.name ?? "a baby";

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
            <Flame className="h-6 w-6 text-accent" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">beanlo</h1>
        </div>

        <Card className="p-6 text-center">
          {!invite || invite.status !== "pending" ? (
            <>
              <p className="font-semibold">This invite isn’t valid</p>
              <p className="mt-1 text-sm text-muted">
                It may have been accepted already or revoked. Ask for a new link.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">You’re invited to follow {babyName}</p>
              <p className="mt-1 text-sm text-muted">
                as{" "}
                {invite.role === "viewer"
                  ? "a healthcare professional (read-only)"
                  : `a ${invite.role}`}
                , sent to {invite.email}
              </p>

              {user ? (
                <form
                  action={async () => {
                    "use server";
                    await acceptInvite(token);
                  }}
                  className="mt-5"
                >
                  <Button type="submit" className="w-full">
                    Accept invite
                  </Button>
                  {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                    <p className="mt-3 text-xs text-alert">
                      You’re signed in as {user.email} — this invite is for{" "}
                      {invite.email}.
                    </p>
                  )}
                </form>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="mt-5 block"
                >
                  <Button className="w-full">Sign in to accept</Button>
                </Link>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
