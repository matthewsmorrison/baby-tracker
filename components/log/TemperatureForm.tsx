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

export function TemperatureForm({
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
  const [temp, setTemp] = useState(initial?.temp_c?.toString() ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = parseFloat(temp);
  const high = Number.isFinite(t) && t >= 38;
  const low = Number.isFinite(t) && t < 36;

  async function save() {
    if (!(t >= 30 && t <= 43)) {
      setError("Enter a temperature in °C (e.g. 36.8).");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "temperature" as const,
      occurred_at: fromLocalInputValue(occurredAt),
      temp_c: Math.round(t * 10) / 10,
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
      setTemp("");
      setNote("");
      setOccurredAt(toLocalInputValue(new Date()));
      onSaved(initial ? "Changes saved" : "Temperature saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <Label htmlFor="temp_c">Temperature (°C)</Label>
        <Input
          id="temp_c"
          type="number"
          inputMode="decimal"
          step={0.1}
          min={30}
          max={43}
          placeholder="e.g. 36.8"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
        />
        <p className="mt-1 text-xs text-faint">
          A normal temperature for a baby is around 36.4 °C — it varies a
          little. Armpit readings are the NHS-recommended way under 5.
        </p>
      </div>

      {high && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert">
          38 °C or above in a baby under 3 months needs same-day medical advice
          — call your GP or NHS 111 now (999 if they seem seriously unwell).
        </p>
      )}
      {low && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert">
          Below 36 °C can also be a concern in a young baby — warm them
          gradually and seek advice if it doesn’t come up or they seem unwell.
        </p>
      )}

      <NoteField note={note} setNote={setNote} />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save temperature"}
      </Button>
    </Card>
  );
}
