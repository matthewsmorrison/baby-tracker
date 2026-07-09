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

/**
 * Log a breast-pumping session: how much was expressed and when. The time is
 * what powers the "best time to pump" view, so it's front and centre; an
 * optional end time captures how long the session took.
 */
export function PumpForm({
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
      : toLocalInputValue(new Date())
  );
  const [endAt, setEndAt] = useState(() =>
    initial?.ended_at ? toLocalInputValue(new Date(initial.ended_at)) : ""
  );
  const [ml, setMl] = useState(initial?.expressed_ml?.toString() ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMs = new Date(fromLocalInputValue(startAt)).getTime();
  const endMs = endAt ? new Date(fromLocalInputValue(endAt)).getTime() : null;
  const durationOk = endMs === null || endMs > startMs;

  async function save() {
    const amount = parseInt(ml, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter how much you expressed, in ml.");
      return;
    }
    if (!durationOk) {
      setError("The end time needs to be after the start.");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "pump" as const,
      occurred_at: fromLocalInputValue(startAt),
      ended_at: endAt ? fromLocalInputValue(endAt) : null,
      expressed_ml: amount,
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
      onSaved(initial ? "Changes saved" : "Pump saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <p className="text-xs text-faint">
        Log a pumping session. Over time, the Charts tab shows which times of
        day give you the most milk.
      </p>

      <div>
        <Label htmlFor="pump_ml">Expressed (ml)</Label>
        <Input
          id="pump_ml"
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          placeholder="e.g. 90"
          value={ml}
          onChange={(e) => setMl(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <Label>Started</Label>
        <OccurredAtField value={startAt} onChange={setStartAt} />
      </div>

      <div>
        <Label htmlFor="pump_end">Finished (optional)</Label>
        <Input
          id="pump_end"
          type="datetime-local"
          value={endAt}
          min={startAt}
          onChange={(e) => setEndAt(e.target.value)}
        />
        {endMs !== null && durationOk && (
          <p className="mt-1.5 rounded-2xl bg-surface-alt px-4 py-2 text-xs font-medium text-muted">
            {formatDuration(endMs - startMs)} pumping
          </p>
        )}
      </div>

      <NoteField note={note} setNote={setNote} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save pump"}
      </Button>
    </Card>
  );
}
