"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import type { Entry, FeedType } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";

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
  const [feedType, setFeedType] = useState<FeedType>(
    initial?.feed_type ?? "breast"
  );
  const [leftMin, setLeftMin] = useState(initial?.left_min?.toString() ?? "");
  const [rightMin, setRightMin] = useState(initial?.right_min?.toString() ?? "");
  const [volume, setVolume] = useState(initial?.volume_ml?.toString() ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const isBreast = feedType === "breast";
    const left = parseInt(leftMin, 10);
    const right = parseInt(rightMin, 10);
    const ml = parseInt(volume, 10);

    if (isBreast && !(left > 0 || right > 0)) {
      setError("Enter minutes for at least one side.");
      return;
    }
    if (!isBreast && !(ml > 0)) {
      setError("Enter the amount in ml.");
      return;
    }

    setError(null);
    setBusy(true);
    const supabase = createClient();

    const row = {
      baby_id: babyId,
      type: "feed" as const,
      occurred_at: fromLocalInputValue(occurredAt),
      feed_type: feedType,
      left_min: isBreast && left > 0 ? left : null,
      right_min: isBreast && right > 0 ? right : null,
      volume_ml: !isBreast ? ml : null,
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
      setLeftMin("");
      setRightMin("");
      setVolume("");
      setNote("");
      setOccurredAt(toLocalInputValue(new Date()));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <Segmented<FeedType>
        options={[
          { value: "breast", label: "Breast" },
          { value: "formula", label: "Formula" },
          { value: "expressed", label: "Expressed" },
        ]}
        value={feedType}
        onChange={setFeedType}
      />

      {feedType === "breast" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="left_min">Left (min)</Label>
            <Input
              id="left_min"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              placeholder="0"
              value={leftMin}
              onChange={(e) => setLeftMin(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="right_min">Right (min)</Label>
            <Input
              id="right_min"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              placeholder="0"
              value={rightMin}
              onChange={(e) => setRightMin(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="volume_ml">Amount (ml)</Label>
          <Input
            id="volume_ml"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            placeholder="e.g. 60"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            {[30, 60, 90].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVolume(String(v))}
                className="rounded-full border border-line bg-surface-alt px-3.5 py-1.5 text-xs font-medium text-muted hover:text-ink"
              >
                {v} ml
              </button>
            ))}
          </div>
          {feedType === "expressed" && (
            <p className="mt-3 rounded-2xl bg-positive-bg px-4 py-3 text-sm text-positive">
              Expressed breastmilk counts as breastfeeding for his poo — it’s
              the formula that changes colour and texture.
            </p>
          )}
        </div>
      )}

      <NoteField note={note} setNote={setNote} />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save feed"}
      </Button>
    </Card>
  );
}
