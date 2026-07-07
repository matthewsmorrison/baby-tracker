"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import type { Entry, FeedNotes } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";
import { MessageSquarePlus } from "lucide-react";

type RowKey = keyof FeedNotes;

/**
 * One component of a combined feed: an amount plus its own optional note
 * ("latched well", "breast still sore after feed", …).
 */
function FeedRow({
  label,
  unit,
  value,
  onChange,
  note,
  onNote,
  quick,
  max,
}: {
  label: string;
  unit: "min" | "ml";
  value: string;
  onChange: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  quick?: number[];
  max: number;
}) {
  const [noteOpen, setNoteOpen] = useState(!!note);
  const id = `feed-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="rounded-2xl bg-surface-alt p-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="mb-0 flex-1 text-ink">
          {label}
        </Label>
        <div className="relative w-28">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-surface pr-11 py-2.5 text-right"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-faint">
            {unit}
          </span>
        </div>
        <button
          type="button"
          aria-label={`Add a note about ${label}`}
          aria-expanded={noteOpen}
          onClick={() => setNoteOpen(!noteOpen)}
          className={`rounded-full p-2 transition ${
            note || noteOpen
              ? "bg-accent-soft text-ink"
              : "text-faint hover:text-ink"
          }`}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
      {quick && (
        <div className="mt-2 flex gap-2">
          {quick.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(String(v))}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted hover:text-ink"
            >
              {v} {unit}
            </button>
          ))}
        </div>
      )}
      {noteOpen && (
        <input
          aria-label={`Note for ${label}`}
          className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-faint focus:border-ink focus:outline-none"
          placeholder="e.g. latched well, breast still sore after feed"
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      )}
    </div>
  );
}

export function FeedForm({
  babyId,
  initial,
  onDone,
}: {
  babyId: string;
  birthAt?: string;
  entries?: Entry[];
  initial?: Entry;
  onDone: () => void;
}) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [endedAt, setEndedAt] = useState(() =>
    initial?.ended_at ? toLocalInputValue(new Date(initial.ended_at)) : ""
  );

  // Legacy rows stored bottle amounts in volume_ml.
  const initAmount = (key: RowKey): string => {
    if (!initial) return "";
    if (key === "left") return initial.left_min?.toString() ?? "";
    if (key === "right") return initial.right_min?.toString() ?? "";
    if (key === "expressed")
      return (
        initial.expressed_ml ??
        (initial.feed_type === "expressed" ? initial.volume_ml : null)
      )?.toString() ?? "";
    return (
      initial.formula_ml ??
      (initial.feed_type === "formula" ? initial.volume_ml : null)
    )?.toString() ?? "";
  };

  const [amounts, setAmounts] = useState<Record<RowKey, string>>({
    left: initAmount("left"),
    right: initAmount("right"),
    expressed: initAmount("expressed"),
    formula: initAmount("formula"),
  });
  const [rowNotes, setRowNotes] = useState<Record<RowKey, string>>({
    left: initial?.feed_notes?.left ?? "",
    right: initial?.feed_notes?.right ?? "",
    expressed: initial?.feed_notes?.expressed ?? "",
    formula: initial?.feed_notes?.formula ?? "",
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAmount = (k: RowKey) => (v: string) =>
    setAmounts((a) => ({ ...a, [k]: v }));
  const setRowNote = (k: RowKey) => (v: string) =>
    setRowNotes((n) => ({ ...n, [k]: v }));

  async function save() {
    const n = (k: RowKey) => {
      const v = parseInt(amounts[k], 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const left = n("left");
    const right = n("right");
    const expressed = n("expressed");
    const formula = n("formula");

    if (!left && !right && !expressed && !formula) {
      setError("Enter at least one amount — breast minutes or bottle ml.");
      return;
    }

    const startIso = fromLocalInputValue(occurredAt);
    let endIso: string | null = null;
    if (endedAt) {
      endIso = fromLocalInputValue(endedAt);
      if (new Date(endIso) < new Date(startIso)) {
        setError("The end time is before the start time.");
        return;
      }
    }

    const notes: FeedNotes = {};
    (["left", "right", "expressed", "formula"] as RowKey[]).forEach((k) => {
      const t = rowNotes[k].trim();
      if (t) notes[k] = t;
    });

    const hasBreast = !!(left || right);
    const hasBottle = !!(expressed || formula);
    const feedType =
      hasBreast && hasBottle
        ? "mixed"
        : hasBreast
          ? "breast"
          : expressed && formula
            ? "mixed"
            : expressed
              ? "expressed"
              : "formula";

    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "feed" as const,
      occurred_at: startIso,
      ended_at: endIso,
      feed_type: feedType,
      left_min: left,
      right_min: right,
      expressed_ml: expressed,
      formula_ml: formula,
      volume_ml: null, // superseded by the split columns
      feed_notes: Object.keys(notes).length ? notes : null,
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
      setAmounts({ left: "", right: "", expressed: "", formula: "" });
      setRowNotes({ left: "", right: "", expressed: "", formula: "" });
      setNote("");
      setEndedAt("");
      setOccurredAt(toLocalInputValue(new Date()));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <p className="text-xs text-faint -mb-1">
        Fill in whatever this feed included — sides, expressed and formula can
        all go in one entry. Tap{" "}
        <MessageSquarePlus className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
        for a note on that part.
      </p>

      <FeedRow
        label="Left breast"
        unit="min"
        max={120}
        value={amounts.left}
        onChange={setAmount("left")}
        note={rowNotes.left}
        onNote={setRowNote("left")}
      />
      <FeedRow
        label="Right breast"
        unit="min"
        max={120}
        value={amounts.right}
        onChange={setAmount("right")}
        note={rowNotes.right}
        onNote={setRowNote("right")}
      />
      <FeedRow
        label="Expressed milk"
        unit="ml"
        max={500}
        quick={[30, 60, 90]}
        value={amounts.expressed}
        onChange={setAmount("expressed")}
        note={rowNotes.expressed}
        onNote={setRowNote("expressed")}
      />
      <FeedRow
        label="Formula"
        unit="ml"
        max={500}
        quick={[30, 60, 90]}
        value={amounts.formula}
        onChange={setAmount("formula")}
        note={rowNotes.formula}
        onNote={setRowNote("formula")}
      />

      {(parseInt(amounts.expressed, 10) > 0 ||
        parseInt(amounts.formula, 10) > 0) && (
        <p className="rounded-2xl bg-positive-bg px-4 py-3 text-sm text-positive">
          Expressed breastmilk counts as breastfeeding for his poo — it’s the
          formula that changes colour and texture.
        </p>
      )}

      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <Label htmlFor="ended_at" className="mb-0">
            Finished (optional)
          </Label>
          {endedAt && (
            <button
              type="button"
              onClick={() => setEndedAt("")}
              className="text-xs font-medium text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
        <Input
          id="ended_at"
          type="datetime-local"
          value={endedAt}
          min={occurredAt}
          onChange={(e) => setEndedAt(e.target.value)}
        />
      </div>

      <NoteField note={note} setNote={setNote} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save feed"}
      </Button>
    </Card>
  );
}
