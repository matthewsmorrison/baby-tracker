"use client";

import { useState } from "react";
import type { Entry, EntryType } from "@/lib/types";
import { Segmented } from "@/components/ui/Segmented";
import { NappyForm } from "./NappyForm";
import { FeedForm } from "./FeedForm";
import { WeightForm } from "./WeightForm";
import { RecentEntries } from "./RecentEntries";

export function LogClient({
  babyId,
  birthAt,
  entries,
  editId,
}: {
  babyId: string;
  birthAt: string;
  entries: Entry[];
  /** Entry to open for editing straight away (e.g. arriving from History). */
  editId?: string;
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

  const formProps = {
    babyId,
    birthAt,
    entries,
    onDone: done,
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
        <NappyForm key={editing?.id ?? "new-nappy"} {...formProps} initial={editing ?? undefined} />
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
      />
    </div>
  );
}
