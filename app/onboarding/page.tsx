import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { CreateBabyForm } from "./CreateBabyForm";
import { AcceptInviteButton } from "@/components/invite/AcceptInviteButton";
import { Flame } from "lucide-react";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pending invites for this email (RLS: invitee can read their own).
  const { data: invites } = await supabase
    .from("baby_invites")
    .select("id, token, role, baby_id, babies(name)")
    .eq("status", "pending")
    .ilike("email", user.email ?? "");

  return (
    <main className="mx-auto w-full max-w-md p-6 pt-14">
      <div className="mb-8 text-center animate-rise">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
          <Flame className="h-6 w-6 text-accent" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-muted">
          Add your baby — or join a baby you’ve been invited to.
        </p>
      </div>

      {(invites ?? []).length > 0 && (
        <Card className="mb-6 p-6 animate-rise">
          <h2 className="font-semibold mb-3">You’ve been invited</h2>
          <div className="space-y-3">
            {invites!.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">
                    {(inv.babies as unknown as { name: string })?.name ?? "A baby"}
                  </p>
                  <p className="text-xs text-muted">
                    as {inv.role === "viewer" ? "healthcare professional (read-only)" : inv.role}
                  </p>
                </div>
                <AcceptInviteButton token={inv.token} label="Join" size="sm" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 animate-rise">
        <h2 className="mb-3 font-semibold">Add your baby</h2>
        <CreateBabyForm />
      </Card>

      <p className="mt-6 text-center text-xs text-faint">
        Beanlo is a tracking aid, not medical advice or diagnosis.
      </p>
    </main>
  );
}
