import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { setActiveBaby, signOut } from "@/lib/actions";
import { getProfessionalForUser } from "@/lib/pro";
import { dayOfLife } from "@/lib/clinical";
import type { Baby } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flame, LogOut, Users } from "lucide-react";

export const metadata = { title: "Your families — beanlo" };

export default async function ProHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pro = await getProfessionalForUser();
  if (!pro) redirect("/today"); // not a professional — send to the app

  // Families that have added this professional as a carer (read-only viewer).
  const { data: memberships } = await supabase
    .from("baby_members")
    .select("baby:babies(*)")
    .eq("user_id", user.id);
  const families = (memberships ?? [])
    .map((m) => m.baby as unknown as Baby)
    .filter(Boolean);

  // Total sign-ups attributed to this professional's link.
  const svc = createServiceClient();
  const { count: referredCount } = await svc
    .from("babies")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_pro", pro.id);

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
            <Flame className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight">beanlo</span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>

      <Card className="p-5">
        <p className="text-xs font-medium text-muted">Signed in as</p>
        <p className="text-lg font-bold tracking-tight">{pro.name}</p>
        <p className="text-sm text-accent">{pro.title}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-alt p-3 text-center">
            <p className="stat-num text-2xl">{families.length}</p>
            <p className="text-xs text-muted">families sharing with you</p>
          </div>
          <div className="rounded-2xl bg-surface-alt p-3 text-center">
            <p className="stat-num text-2xl">{referredCount ?? 0}</p>
            <p className="text-xs text-muted">signed up via your link</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-faint">
          Your link: beanlo.com/pro/{pro.slug} · code {pro.invite_code}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <CardTitle>Families sharing with you</CardTitle>
        </div>
        {families.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No families yet. When a parent signs up via your link and adds you
            as a carer, they’ll appear here and you’ll be able to view their log
            (read-only).
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {families.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted">
                    Day {dayOfLife(b.birth_at, new Date())}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await setActiveBaby(b.id);
                    redirect("/today");
                  }}
                >
                  <Button type="submit" size="sm" variant="secondary">
                    View log
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 px-2 text-center text-xs text-faint">
        You have read-only access to families who add you. beanlo is a tracking
        aid, not medical advice.
      </p>
    </main>
  );
}
