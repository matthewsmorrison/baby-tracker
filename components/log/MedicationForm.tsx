"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import type { Entry, MedSubject } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";
import { Bell, Plus, X } from "lucide-react";

type MedKind = "dose" | "course";

/**
 * Two shapes of medication logging:
 * - "Dose given": a one-off dose (e.g. Calpol at 3am) — every carer sees
 *   when it was last given on the Today screen.
 * - "Ongoing course": what it is, when it started, and (optionally) when it
 *   stopped, with reminders. Leaving "stopped" empty means still taking it.
 */
export function MedicationForm({
  babyId,
  initial,
  onSaved,
}: {
  babyId: string;
  birthAt?: string;
  entries?: Entry[];
  initial?: Entry;
  onDone?: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MedKind>(
    initial ? (initial.med_kind === "dose" ? "dose" : "course") : "dose"
  );
  const [subject, setSubject] = useState<MedSubject>(
    initial?.med_subject ?? "baby"
  );
  const [name, setName] = useState(initial?.med_name ?? "");
  const [dose, setDose] = useState(initial?.med_dose ?? "");
  const [reminders, setReminders] = useState<string[]>(
    initial?.reminder_times ?? []
  );
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [reminderUsers, setReminderUsers] = useState<string[]>(
    initial?.reminder_user_ids ?? []
  );
  const [startAt, setStartAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [endAt, setEndAt] = useState(() =>
    initial?.ended_at ? toLocalInputValue(new Date(initial.ended_at)) : ""
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the baby's carers so reminders can be sent to any of them, and
  // default a new medication's recipients to the person adding it.
  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const { data: mems } = await sb
        .from("baby_members")
        .select("user_id, role")
        .eq("baby_id", babyId)
        .neq("role", "viewer");
      const ids = (mems ?? []).map((m) => m.user_id);
      const { data: profs } = await sb
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (!alive) return;
      const nameFor = (id: string) => {
        const p = (profs ?? []).find((x) => x.id === id);
        return p?.full_name || p?.email || "Carer";
      };
      setMembers(ids.map((id) => ({ id, name: nameFor(id) })));
      if (!initial && user) {
        setReminderUsers((prev) => (prev.length ? prev : [user.id]));
      }
    })();
    return () => {
      alive = false;
    };
  }, [babyId, initial]);

  const startMs = new Date(fromLocalInputValue(startAt)).getTime();
  const endMs = endAt ? new Date(fromLocalInputValue(endAt)).getTime() : null;
  const rangeOk = kind === "dose" || endMs === null || endMs >= startMs;

  async function save() {
    if (!name.trim()) {
      setError("Enter the medication name.");
      return;
    }
    if (!rangeOk) {
      setError("The stop date needs to be on or after the start.");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const times = kind === "course" ? reminders.filter(Boolean).sort() : [];
    const row = {
      baby_id: babyId,
      type: "medication" as const,
      med_kind: kind,
      med_subject: subject,
      med_name: name.trim(),
      med_dose: dose.trim() || null,
      occurred_at: fromLocalInputValue(startAt),
      ended_at: kind === "course" && endAt ? fromLocalInputValue(endAt) : null,
      reminder_times: times.length ? times : null,
      reminder_tz: times.length
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : null,
      reminder_user_ids:
        times.length && reminderUsers.length ? reminderUsers : null,
      note: note.trim() || null,
    };

    try {
      if (initial) {
        const { error } = await supabase
          .from("entries")
          .update(row)
          .eq("id", initial.id);
        if (error) throw new Error(error.message);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("entries")
          .insert({ ...row, created_by: user!.id });
        if (error) throw new Error(error.message);
      }
      router.refresh();
      setNote("");
      onSaved(initial ? "Changes saved" : "Medication saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <Segmented<MedKind>
        options={[
          { value: "dose", label: "Dose given" },
          { value: "course", label: "Ongoing course" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Segmented<MedSubject>
        options={[
          { value: "baby", label: "Baby’s" },
          { value: "mother", label: "Mother’s" },
        ]}
        value={subject}
        onChange={setSubject}
      />
      <p className="text-xs text-faint">
        {kind === "dose"
          ? "One-off dose — e.g. Calpol at 3am. Everyone caring for the baby sees when it was last given on the Today screen."
          : subject === "mother"
            ? "Some of the mother’s medication can affect the baby via breastmilk — e.g. iron often makes stool darker or greener — so logging it helps make sense of changes."
            : "Track the baby’s own medicines and supplements (e.g. vitamin D drops) as a course, with reminders if you want them."}
      </p>

      <div>
        <Label htmlFor="med_name">Medication</Label>
        <Input
          id="med_name"
          type="text"
          placeholder={kind === "dose" ? "e.g. Calpol" : "e.g. Iron (ferrous sulfate)"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="med_dose">Dose (optional)</Label>
        <Input
          id="med_dose"
          type="text"
          placeholder={kind === "dose" ? "e.g. 2.5 ml" : "e.g. 200 mg, one tablet"}
          value={dose}
          onChange={(e) => setDose(e.target.value)}
        />
      </div>

      {kind === "dose" && (
        <div>
          <Label>Given</Label>
          <OccurredAtField value={startAt} onChange={setStartAt} />
        </div>
      )}

      {kind === "course" && (
      <div>
        <Label>Reminders (optional)</Label>
        <div className="space-y-2">
          {reminders.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="time"
                value={t}
                onChange={(e) =>
                  setReminders((r) =>
                    r.map((x, j) => (j === i ? e.target.value : x))
                  )
                }
              />
              <button
                type="button"
                aria-label="Remove reminder"
                onClick={() =>
                  setReminders((r) => r.filter((_, j) => j !== i))
                }
                className="rounded-full p-2 text-faint hover:bg-alert-bg hover:text-alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setReminders((r) => [...r, "08:00"])}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface-alt px-3.5 py-2 text-xs font-medium text-muted hover:border-ink hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a reminder time
          </button>
        </div>
        {reminders.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-faint">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A phone alert is sent at these times while the course is active.
            Each recipient needs notifications turned on in their Settings.
          </p>
        )}
      </div>
      )}

      {kind === "course" && reminders.length > 0 && members.length > 0 && (
        <div>
          <Label>Send reminders to</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = reminderUsers.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setReminderUsers((u) =>
                      on ? u.filter((x) => x !== m.id) : [...u, m.id]
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-ink bg-ink text-on-ink"
                      : "border-line bg-surface-alt text-muted hover:text-ink"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          {reminderUsers.length === 0 && (
            <p className="mt-1.5 text-xs text-faint">
              No one selected — the person who added this will be reminded.
            </p>
          )}
        </div>
      )}

      {kind === "course" && (
        <>
          <div>
            <Label>Started</Label>
            <OccurredAtField value={startAt} onChange={setStartAt} />
          </div>

          <div>
            <Label htmlFor="med_end">Stopped (leave empty if still taking)</Label>
            <Input
              id="med_end"
              type="datetime-local"
              value={endAt}
              min={startAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        </>
      )}

      <NoteField note={note} setNote={setNote} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy
          ? "Saving…"
          : initial
            ? "Save changes"
            : kind === "dose"
              ? "Save dose"
              : "Save medication"}
      </Button>
    </Card>
  );
}
