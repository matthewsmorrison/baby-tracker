"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Entry, EntryType } from "@/lib/types";
import { Segmented } from "@/components/ui/Segmented";
import { NappyForm } from "./NappyForm";
import { FeedForm } from "./FeedForm";
import { WeightForm } from "./WeightForm";
import { SleepForm } from "./SleepForm";
import { PumpForm } from "./PumpForm";
import { TemperatureForm } from "./TemperatureForm";
import { MilestoneForm } from "./MilestoneForm";
import { MedicationForm } from "./MedicationForm";
import { QuickLog } from "./QuickLog";

/**
 * The log modal's body: tab strip + all nine entry forms. Split from the
 * modal shell so this chunk (and everything the forms drag in — EXIF
 * parsing, the AI quick log) downloads only when the modal first opens
 * instead of on every page load.
 */
export function LogForms({
  babyId,
  birthAt,
  nappyBaseWeightG,
  advanced,
  options,
  tab,
  onTabChange,
  editing,
  onClearEditing,
  onDone,
  onSaved,
}: {
  babyId: string;
  birthAt: string;
  nappyBaseWeightG?: number | null;
  advanced: boolean;
  options: Array<{ value: EntryType; label: string }>;
  tab: EntryType;
  onTabChange: (t: EntryType) => void;
  editing: Entry | null;
  onClearEditing: () => void;
  onDone: () => void;
  onSaved: (message: string) => void;
}) {
  // Recent feeds power NappyForm's feeding-mix hint (expected stool colour).
  // Fetched here, on modal open, instead of being serialised into every
  // page's payload by the layout.
  const [feeds, setFeeds] = useState<Entry[]>([]);
  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    createClient()
      .from("entries")
      .select(
        "id, type, occurred_at, feed_type, left_min, right_min, expressed_ml, formula_ml, volume_ml"
      )
      .eq("baby_id", babyId)
      .eq("type", "feed")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setFeeds((data ?? []) as Entry[]);
      });
    return () => {
      cancelled = true;
    };
  }, [babyId]);

  const formProps = {
    babyId,
    birthAt,
    entries: feeds,
    onDone,
    onSaved,
  };

  return (
    <>
      {advanced && !editing && <QuickLog babyId={babyId} onSaved={onSaved} />}

      {options.length > 1 && (
        <Segmented<EntryType> options={options} value={tab} onChange={onTabChange} />
      )}

      {editing && (
        <div className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-2.5 text-sm">
          <span className="font-medium">Editing an existing entry</span>
          <button
            type="button"
            onClick={onClearEditing}
            className="font-semibold underline underline-offset-2"
          >
            New instead
          </button>
        </div>
      )}

      {tab === "nappy" && (
        <NappyForm
          key={editing?.id ?? "new-nappy"}
          {...formProps}
          initial={editing ?? undefined}
          nappyBaseWeightG={nappyBaseWeightG}
        />
      )}
      {tab === "feed" && (
        <FeedForm
          key={editing?.id ?? "new-feed"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "sleep" && (
        <SleepForm
          key={editing?.id ?? "new-sleep"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "weight" && (
        <WeightForm
          key={editing?.id ?? "new-weight"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "pump" && (
        <PumpForm
          key={editing?.id ?? "new-pump"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "carer_sleep" && (
        <SleepForm
          key={editing?.id ?? "new-carer-sleep"}
          {...formProps}
          initial={editing ?? undefined}
          variant="carer"
        />
      )}
      {tab === "temperature" && (
        <TemperatureForm
          key={editing?.id ?? "new-temperature"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "milestone" && (
        <MilestoneForm
          key={editing?.id ?? "new-milestone"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
      {tab === "medication" && (
        <MedicationForm
          key={editing?.id ?? "new-medication"}
          {...formProps}
          initial={editing ?? undefined}
        />
      )}
    </>
  );
}
