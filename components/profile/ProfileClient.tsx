"use client";

import { useState, useTransition } from "react";
import {
  createInvite,
  leaveBaby,
  removeMember,
  revokeInvite,
  signOut,
  updateBirthDetails,
} from "@/lib/actions";
import { toLocalInputValue } from "@/lib/dates";
import type { Baby, BabyInvite, BabyMember, Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Chip";
import { Check, Copy, LogOut, Pencil, X } from "lucide-react";

export function EditBirthDetails({ baby }: { baby: Baby }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit birth details
      </Button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            await updateBirthDetails(fd);
            setOpen(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save");
          }
        })
      }
      className="mt-4 space-y-3 rounded-2xl bg-surface-alt p-4"
    >
      <input type="hidden" name="baby_id" value={baby.id} />
      <div>
        <Label htmlFor="pname">Name</Label>
        <Input id="pname" name="name" defaultValue={baby.name} required />
      </div>
      <div>
        <Label htmlFor="pbirth">Date &amp; time of birth</Label>
        <Input
          id="pbirth"
          name="birth_at"
          type="datetime-local"
          defaultValue={toLocalInputValue(new Date(baby.birth_at))}
          required
        />
      </div>
      <div>
        <Label htmlFor="pweight">Birth weight (g)</Label>
        <Input
          id="pweight"
          name="birth_weight_g"
          type="number"
          inputMode="numeric"
          defaultValue={baby.birth_weight_g}
          min={500}
          max={7000}
          required
        />
      </div>
      <div>
        <Label htmlFor="pnappy">Dry nappy weight (g)</Label>
        <Input
          id="pnappy"
          name="nappy_base_weight_g"
          type="number"
          inputMode="numeric"
          defaultValue={baby.nappy_base_weight_g ?? ""}
          min={5}
          max={200}
          placeholder="weigh a clean nappy, e.g. 28"
        />
        <p className="mt-1 text-xs text-faint">
          With this set, weighing a used nappy in Log tells the app how much
          wee is in it (1 g ≈ 1 ml) and marks it wet automatically.
        </p>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function MemberRow({
  member,
  profile,
  isSelf,
  canManage,
}: {
  member: BabyMember;
  profile: Profile | null;
  isSelf: boolean;
  canManage: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const name = profile?.full_name || profile?.email || "Carer";
  const roleLabel =
    member.role === "viewer"
      ? "healthcare · read-only"
      : member.role === "owner"
        ? "owner"
        : "caregiver";

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {name}
          {isSelf && <span className="text-faint"> (you)</span>}
        </p>
        {profile?.email && (
          <p className="truncate text-xs text-muted">{profile.email}</p>
        )}
      </div>
      <Chip tone={member.role === "viewer" ? "neutral" : "positive"}>
        {roleLabel}
      </Chip>
      {canManage && !isSelf && (
        <>
          {confirming ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeMember(member.id);
                })
              }
              className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
            >
              {pending ? "Removing…" : "Remove?"}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Remove member"
              onClick={() => setConfirming(true)}
              className="rounded-full p-1.5 text-faint hover:bg-alert-bg hover:text-alert"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </li>
  );
}

export function InviteSection({
  babyId,
  invites,
}: {
  babyId: string;
  invites: BabyInvite[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function inviteUrl(token: string) {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/invite/${token}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-sm font-semibold mb-2">Invite someone</p>
      <form
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            try {
              await createInvite(fd);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not invite");
            }
          })
        }
        className="space-y-2"
      >
        <input type="hidden" name="baby_id" value={babyId} />
        <Input
          name="email"
          type="email"
          required
          placeholder="their@email.com"
          aria-label="Invitee email"
        />
        <div className="flex gap-2">
          <select
            name="role"
            aria-label="Role"
            className="flex-1 rounded-2xl border border-line bg-surface-alt px-4 py-2.5 text-sm"
            defaultValue="caregiver"
          >
            <option value="caregiver">Carer — can log &amp; edit</option>
            <option value="viewer">
              Healthcare professional — read-only
            </option>
          </select>
          <Button type="submit" size="md" disabled={pending}>
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
      <p className="mt-2 text-xs text-faint">
        Email sending isn’t wired up yet — share the invite link below after
        creating it.
      </p>

      {invites.length > 0 && (
        <ul className="mt-3 space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-2 rounded-2xl bg-surface-alt px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.email}</p>
                <p className="text-xs text-muted">
                  {inv.role === "viewer" ? "read-only" : "caregiver"} · pending
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(inv.token)}
                className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 text-xs font-medium"
              >
                {copied === inv.token ? (
                  <>
                    <Check className="h-3 w-3 text-positive" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Link
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => startTransition(() => revokeInvite(inv.id))}
                className="rounded-full p-1.5 text-faint hover:bg-alert-bg hover:text-alert"
                aria-label="Revoke invite"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeaveOrSignOut({
  membershipId,
  isOwner,
  babyName,
}: {
  membershipId: string | null;
  isOwner: boolean;
  babyName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => startTransition(() => signOut())}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
      {!isOwner && membershipId && (
        <>
          {confirming ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await leaveBaby(membershipId);
                })
              }
            >
              {pending ? "Leaving…" : `Really leave ${babyName}?`}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Leave {babyName}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
