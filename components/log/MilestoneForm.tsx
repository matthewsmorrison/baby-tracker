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

const SUGGESTIONS = [
  "First smile",
  "First laugh",
  "Held head up",
  "Rolled over",
  "Slept 5h+ stretch",
  "First bath",
  "Grasped a finger",
  "First outing",
];

export function MilestoneForm({
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
  const [occurredAt, setOccurredAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [label, setLabel] = useState(initial?.milestone_label ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!label.trim()) {
      setError("What happened? Give the moment a name.");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "milestone" as const,
      occurred_at: fromLocalInputValue(occurredAt),
      milestone_label: label.trim(),
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
      setLabel("");
      setNote("");
      setOccurredAt(toLocalInputValue(new Date()));
      onSaved(initial ? "Changes saved" : "Milestone saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <Label htmlFor="milestone">Milestone</Label>
        <Input
          id="milestone"
          type="text"
          maxLength={120}
          placeholder="e.g. First smile"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLabel(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                label === s
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-faint">
          Babies reach these in their own time — this is a memory book, not a
          checklist.
        </p>
      </div>

      <NoteField note={note} setNote={setNote} />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save milestone"}
      </Button>
    </Card>
  );
}
