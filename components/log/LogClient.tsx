"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, EntryType } from "@/lib/types";
import { Segmented } from "@/components/ui/Segmented";
import { NappyForm } from "./NappyForm";
import { FeedForm } from "./FeedForm";
import { WeightForm } from "./WeightForm";
import { RecentEntries } from "./RecentEntries";
import { Check } from "lucide-react";

export function LogClient({
  babyId,
  birthAt,
  entries,
  editId,
  nappyBaseWeightG,
}: {
  babyId: string;
  birthAt: string;
  entries: Entry[];
  /** Entry to open for editing straight away (e.g. arriving from History). */
  editId?: string;
  nappyBaseWeightG?: number | null;
}) {
  const [editing, setEditing] = useState<Entry | null>(
    () => entries.find((e) => e.id === editId) ?? null
  );
  const [tab, setTab] = useState<EntryType>(
    () => entries.find((e) => e.id === editId)?.type ?? "nappy"
  );

  function startEdit(entry: Entry) {
    setEditing(entry);
    setTab(entry.type);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function done() {
    setEditing(null);
  }

  // Snackbar: confirm saves, then close whatever was being edited.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  function notify(message: string) {
    setEditing(null);
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const formProps = {
    babyId,
    birthAt,
    entries,
    onDone: done,
    onSaved: notify,
  };

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="sr-only">Log</h1>

      <Segmented<EntryType>
        options={[
          { value: "nappy", label: "Nappy" },
          { value: "feed", label: "Feed" },
          { value: "weight", label: "Weight" },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          if (editing && editing.type !== t) setEditing(null);
        }}
      />

      {editing && (
        <div className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-2.5 text-sm">
          <span className="font-medium">Editing an existing entry</span>
          <button
            type="button"
            onClick={done}
            className="font-semibold underline underline-offset-2"
          >
            Cancel
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
        <FeedForm key={editing?.id ?? "new-feed"} {...formProps} initial={editing ?? undefined} />
      )}
      {tab === "weight" && (
        <WeightForm key={editing?.id ?? "new-weight"} {...formProps} initial={editing ?? undefined} />
      )}

      <RecentEntries
        entries={entries.slice(0, 20)}
        birthAt={birthAt}
        onEdit={startEdit}
        onDeleted={() => notify("Entry deleted")}
      />

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex justify-center md:bottom-6">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-card animate-rise">
            <Check className="h-4 w-4 text-positive-bar" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
