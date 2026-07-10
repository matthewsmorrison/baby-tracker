"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";

/**
 * Log a medication the mother is taking, as a course: what it is, when it
 * started, and (optionally) when it stopped. Leaving "stopped" empty means
 * still taking it. Recorded so trends can be spotted — e.g. iron often makes
 * stool darker or greener.
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
  const [name, setName] = useState(initial?.med_name ?? "");
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

  const startMs = new Date(fromLocalInputValue(startAt)).getTime();
  const endMs = endAt ? new Date(fromLocalInputValue(endAt)).getTime() : null;
  const rangeOk = endMs === null || endMs >= startMs;

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

    const row = {
      baby_id: babyId,
      type: "medication" as const,
      med_name: name.trim(),
      occurred_at: fromLocalInputValue(startAt),
      ended_at: endAt ? fromLocalInputValue(endAt) : null,
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
      <p className="text-xs text-faint">
        Track medication the mother is taking. Some can affect the baby via
        breastmilk — e.g. iron often makes stool darker or greener — so logging
        it helps make sense of changes.
      </p>

      <div>
        <Label htmlFor="med_name">Medication</Label>
        <Input
          id="med_name"
          type="text"
          placeholder="e.g. Iron (ferrous sulfate)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

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

      <NoteField note={note} setNote={setNote} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save medication"}
      </Button>
    </Card>
  );
}
