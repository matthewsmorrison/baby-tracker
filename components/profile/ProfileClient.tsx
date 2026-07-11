"use client";

import { useState, useTransition } from "react";
import {
  createInvite,
  deleteAccount,
  deleteBaby,
  leaveBaby,
  removeMember,
  revokeInvite,
  signOut,
  updateBabySetting,
} from "@/lib/actions";
import { toLocalInputValue } from "@/lib/dates";
import type { Baby, BabyInvite, BabyMember, Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Chip";
import { Check, Copy, LogOut, Pencil, X } from "lucide-react";

interface SettingSpec {
  field: string;
  label: string;
  display: string;
  /** Current raw value for the input. */
  value: string;
  inputType: "text" | "number" | "datetime-local";
  placeholder?: string;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
  required?: boolean;
}

function SettingRow({ babyId, spec, canEdit }: {
  babyId: string;
  spec: SettingSpec;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const id = `setting-${spec.field}`;

  if (!editing) {
    return (
      <li className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{spec.label}</p>
          <p className="truncate text-sm font-medium">{spec.display}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            aria-label={`Edit ${spec.label}`}
            onClick={() => setEditing(true)}
            className="rounded-full p-2 text-faint hover:bg-surface-alt hover:text-ink"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="py-3">
      <form
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            try {
              await updateBabySetting(fd);
              setEditing(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save");
            }
          })
        }
        className="space-y-2"
      >
        <input type="hidden" name="baby_id" value={babyId} />
        <input type="hidden" name="field" value={spec.field} />
        <Label htmlFor={id}>{spec.label}</Label>
        <Input
          id={id}
          name="value"
          type={spec.inputType}
          inputMode={spec.inputType === "number" ? "decimal" : undefined}
          defaultValue={spec.value}
          placeholder={spec.placeholder}
          step={spec.step}
          min={spec.min}
          max={spec.max}
          required={spec.required}
          autoFocus
        />
        {spec.hint && <p className="text-xs text-faint">{spec.hint}</p>}
        {error && <p className="text-sm text-alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}

function SexRow({
  babyId,
  sex,
  canEdit,
}: {
  babyId: string;
  sex: "boy" | "girl" | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(v: "boy" | "girl") {
    startTransition(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set("baby_id", babyId);
        fd.set("field", "sex");
        fd.set("value", v);
        await updateBabySetting(fd);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  if (!editing) {
    return (
      <li className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">Sex</p>
          <p className="truncate text-sm font-medium capitalize">
            {sex ?? "Not set"}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            aria-label="Edit sex"
            onClick={() => setEditing(true)}
            className="rounded-full p-2 text-faint hover:bg-surface-alt hover:text-ink"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="py-3">
      <Label>Sex</Label>
      <div className="grid grid-cols-2 gap-2">
        {(["boy", "girl"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            aria-pressed={sex === s}
            onClick={() => choose(s)}
            className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold capitalize transition ${
              sex === s
                ? "border-ink bg-ink text-on-ink"
                : "border-line bg-surface-alt text-muted hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-faint">Used for the WHO weight centiles.</p>
      {error && <p className="mt-1 text-sm text-alert">{error}</p>}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
    </li>
  );
}

export function BabySettings({ baby, canEdit }: { baby: Baby; canEdit: boolean }) {
  const specs: SettingSpec[] = [
    {
      field: "name",
      label: "Name",
      display: baby.name,
      value: baby.name,
      inputType: "text",
      required: true,
    },
    {
      field: "birth_at",
      label: "Date & time of birth",
      display: new Date(baby.birth_at).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      value: toLocalInputValue(new Date(baby.birth_at)),
      inputType: "datetime-local",
      required: true,
    },
    {
      field: "birth_weight_g",
      label: "Birth weight",
      display: `${baby.birth_weight_g} g`,
      value: String(baby.birth_weight_g),
      inputType: "number",
      min: 500,
      max: 7000,
      required: true,
    },
    {
      field: "nappy_base_weight_g",
      label: "Dry nappy weight",
      display: baby.nappy_base_weight_g
        ? `${baby.nappy_base_weight_g} g`
        : "Not set",
      value: baby.nappy_base_weight_g?.toString() ?? "",
      inputType: "number",
      min: 5,
      max: 200,
      placeholder: "weigh a clean nappy, e.g. 28",
      hint: "With this set, weighing a used nappy tells the app how much wee is in it (1 g ≈ 1 ml). Leave empty to turn inference off.",
    },
    {
      field: "feed_interval_h",
      label: "Time between feeds",
      display: baby.feed_interval_min
        ? `${baby.feed_interval_min % 60 === 0 ? baby.feed_interval_min / 60 : (baby.feed_interval_min / 60).toFixed(1)} hours`
        : "Not set — next feed not shown",
      value: baby.feed_interval_min ? String(baby.feed_interval_min / 60) : "",
      inputType: "number",
      step: 0.5,
      min: 0.5,
      max: 12,
      placeholder: "e.g. 3",
      hint: "When set, Today shows when the next feed is due. Leave empty to feed purely on cues.",
    },
  ];

  return (
    <ul className="mt-3 divide-y divide-line border-t border-line">
      {specs.map((spec) => (
        <SettingRow key={spec.field} babyId={baby.id} spec={spec} canEdit={canEdit} />
      ))}
      <SexRow babyId={baby.id} sex={baby.sex} canEdit={canEdit} />
    </ul>
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            name="role"
            aria-label="Role"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-alt px-4 py-2.5 text-sm"
            defaultValue="caregiver"
          >
            <option value="caregiver">Carer — can log &amp; edit</option>
            <option value="viewer">
              Healthcare professional — read-only
            </option>
          </select>
          <Button
            type="submit"
            size="md"
            disabled={pending}
            className="w-full shrink-0 sm:w-auto"
          >
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


export function DangerZone({
  babyId,
  babyName,
  isOwner,
}: {
  babyId: string;
  babyName: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmBaby, setConfirmBaby] = useState(false);
  const [confirmAcct, setConfirmAcct] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="border-alert/30 p-5">
      <CardTitle className="text-alert">Danger zone</CardTitle>

      {isOwner && (
        <div className="mt-3 border-b border-line pb-4">
          <p className="text-sm font-medium">Delete {babyName}</p>
          <p className="mt-0.5 text-xs text-muted">
            Permanently removes {babyName}’s feeds, nappies, sleep, weights,
            notes and photos — for every carer. This can’t be undone.
          </p>
          {confirmBaby ? (
            <div className="mt-2 flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await deleteBaby(babyId);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not delete");
                    }
                  })
                }
              >
                {pending ? "Deleting…" : `Yes, delete everything`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmBaby(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              className="mt-2"
              onClick={() => setConfirmBaby(true)}
            >
              Delete {babyName}
            </Button>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-medium">Delete your account</p>
        <p className="mt-0.5 text-xs text-muted">
          Removes your sign-in and your data. Any baby you own is deleted for
          everyone; babies shared with you simply lose your access.
        </p>
        {confirmAcct ? (
          <div className="mt-2 flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    await deleteAccount();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not delete");
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Yes, delete my account"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmAcct(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="mt-2"
            onClick={() => setConfirmAcct(true)}
          >
            Delete account
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-alert">{error}</p>}
    </Card>
  );
}
