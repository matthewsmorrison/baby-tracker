"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { formatDuration } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";

export function SleepForm({
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
  const [startAt, setStartAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date(Date.now() - 60 * 60 * 1000)) // default: an hour ago
  );
  const [endAt, setEndAt] = useState(() =>
    initial?.ended_at
      ? toLocalInputValue(new Date(initial.ended_at))
      : toLocalInputValue(new Date())
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMs = new Date(fromLocalInputValue(startAt)).getTime();
  const endMs = new Date(fromLocalInputValue(endAt)).getTime();
  const durationOk = endMs > startMs;

  async function save() {
    if (!durationOk) {
      setError("The wake time needs to be after the sleep started.");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "sleep" as const,
      occurred_at: fromLocalInputValue(startAt),
      ended_at: fromLocalInputValue(endAt),
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
      onSaved(initial ? "Changes saved" : "Sleep saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <p className="text-xs text-faint">
        Log a stretch of sleep — fell asleep and woke times.
      </p>

      <div>
        <Label>Fell asleep</Label>
        <OccurredAtField value={startAt} onChange={setStartAt} />
      </div>

      <div>
        <Label htmlFor="wake_at">Woke</Label>
        <Input
          id="wake_at"
          type="datetime-local"
          value={endAt}
          min={startAt}
          onChange={(e) => setEndAt(e.target.value)}
        />
      </div>

      {durationOk && (
        <p className="rounded-2xl bg-surface-alt px-4 py-2.5 text-sm font-medium text-muted">
          {formatDuration(endMs - startMs)} asleep
        </p>
      )}

      <NoteField note={note} setNote={setNote} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save sleep"}
      </Button>
    </Card>
  );
}
