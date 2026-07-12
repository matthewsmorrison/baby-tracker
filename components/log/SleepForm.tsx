"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { formatDuration } from "@/lib/entryDisplay";
import type { Entry, SettleMethod, SleepLocation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { NoteField } from "./NappyForm";
import { OptionChips } from "./OptionChips";

const LOCATIONS: Array<{ value: SleepLocation; label: string }> = [
  { value: "cot", label: "Cot / crib" },
  { value: "arms", label: "In arms" },
  { value: "next_to_me", label: "Next-to-me" },
  { value: "pram", label: "Pram" },
  { value: "car_seat", label: "Car seat" },
  { value: "other", label: "Other" },
];
const SETTLES: Array<{ value: SettleMethod; label: string }> = [
  { value: "self", label: "Self-settled" },
  { value: "fed", label: "Fed to sleep" },
  { value: "rocked", label: "Rocked" },
  { value: "dummy", label: "Dummy" },
  { value: "other", label: "Other" },
];

export function SleepForm({
  babyId,
  initial,
  onSaved,
  variant = "baby",
}: {
  babyId: string;
  birthAt?: string;
  entries?: Entry[];
  initial?: Entry;
  onDone?: () => void;
  onSaved: (message: string) => void;
  /** "baby" logs the baby's sleep; "carer" logs the logged-in carer's rest. */
  variant?: "baby" | "carer";
}) {
  const router = useRouter();
  const isCarer = variant === "carer";
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
  const [location, setLocation] = useState<SleepLocation | null>(
    initial?.sleep_location ?? null
  );
  const [settle, setSettle] = useState<SettleMethod | null>(
    initial?.settle_method ?? null
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
      type: (isCarer ? "carer_sleep" : "sleep") as "sleep" | "carer_sleep",
      occurred_at: fromLocalInputValue(startAt),
      ended_at: fromLocalInputValue(endAt),
      sleep_location: isCarer ? null : location,
      settle_method: isCarer ? null : settle,
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
      onSaved(
        initial ? "Changes saved" : isCarer ? "Rest saved" : "Sleep saved"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <p className="text-xs text-faint">
        {isCarer
          ? "Log a stretch of your own sleep — when you dropped off and woke."
          : "Log a stretch of sleep — fell asleep and woke times."}
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

      {!isCarer && (
        <>
          <div>
            <Label>Where (optional)</Label>
            <OptionChips
              options={LOCATIONS}
              value={location}
              onChange={setLocation}
            />
          </div>
          <div>
            <Label>How they settled (optional)</Label>
            <OptionChips options={SETTLES} value={settle} onChange={setSettle} />
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
            : isCarer
              ? "Save rest"
              : "Save sleep"}
      </Button>
    </Card>
  );
}
