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

export function WeightForm({
  babyId,
  initial,
  onSaved,
}: {
  babyId: string;
  birthAt?: string;
  entries?: Entry[];
  initial?: Entry;
  onDone?: () => void;
  /** Confirm a successful save (snackbar) and close any edit state. */
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [grams, setGrams] = useState(initial?.weight_g?.toString() ?? "");
  const [lengthCm, setLengthCm] = useState(
    initial?.length_mm ? (initial.length_mm / 10).toString() : ""
  );
  const [headCm, setHeadCm] = useState(
    initial?.head_circ_mm ? (initial.head_circ_mm / 10).toString() : ""
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const g = parseInt(grams, 10);
    if (!(g >= 500 && g <= 10000)) {
      setError("Enter a weight in grams (e.g. 3620).");
      return;
    }
    const toMm = (v: string, lo: number, hi: number): number | null | false => {
      if (!v.trim()) return null;
      const cm = parseFloat(v);
      if (!(cm >= lo && cm <= hi)) return false;
      return Math.round(cm * 10);
    };
    const lengthMm = toMm(lengthCm, 30, 100);
    const headMm = toMm(headCm, 25, 60);
    if (lengthMm === false) {
      setError("Enter the length in cm (e.g. 52.5).");
      return;
    }
    if (headMm === false) {
      setError("Enter the head circumference in cm (e.g. 36.5).");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "weight" as const,
      occurred_at: fromLocalInputValue(occurredAt),
      weight_g: g,
      length_mm: lengthMm,
      head_circ_mm: headMm,
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
      setGrams("");
      setLengthCm("");
      setHeadCm("");
      setNote("");
      setOccurredAt(toLocalInputValue(new Date()));
      onSaved(initial ? "Changes saved" : "Weight saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <Label htmlFor="weight_g">Weight (g)</Label>
        <Input
          id="weight_g"
          type="number"
          inputMode="numeric"
          min={500}
          max={10000}
          placeholder="e.g. 3620"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
        />
        <p className="mt-1 text-xs text-faint">
          Naked weight on the same scales each time gives the truest trend.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="length_cm">Length (optional, cm)</Label>
          <Input
            id="length_cm"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={30}
            max={100}
            placeholder="e.g. 52.5"
            value={lengthCm}
            onChange={(e) => setLengthCm(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="head_cm">Head (optional, cm)</Label>
          <Input
            id="head_cm"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={25}
            max={60}
            placeholder="e.g. 36.5"
            value={headCm}
            onChange={(e) => setHeadCm(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-faint">
        Usually measured together at clinic — add them here and they’ll appear
        in the reports alongside the weight.
      </p>

      <NoteField note={note} setNote={setNote} />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save weight"}
      </Button>
    </Card>
  );
}
