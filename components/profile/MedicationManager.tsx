"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MedicationForm } from "@/components/log/MedicationForm";
import { Bell, Pencil, Pill, Plus, Trash2 } from "lucide-react";

function isActive(m: Entry): boolean {
  return !m.ended_at || new Date(m.ended_at) >= new Date();
}

function sinceLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function MedicationManager({
  babyId,
  canEdit,
}: {
  babyId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const [meds, setMeds] = useState<Entry[] | null>(null);
  const [mode, setMode] = useState<"list" | "new" | { edit: Entry }>("list");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("baby_id", babyId)
      .eq("type", "medication")
      // Courses only — one-off doses live in the log and on Today.
      .eq("med_kind", "course")
      .order("occurred_at", { ascending: false });
    setMeds((data as Entry[]) ?? []);
  }, [supabase, babyId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("entries")
        .select("*")
        .eq("baby_id", babyId)
        .eq("type", "medication")
        .order("occurred_at", { ascending: false });
      if (alive) setMeds((data as Entry[]) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, babyId]);

  function onSaved() {
    setMode("list");
    load();
    router.refresh(); // keep Today's summary in sync
  }

  async function stop(id: string) {
    setBusyId(id);
    await supabase
      .from("entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    load();
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    await supabase.from("entries").delete().eq("id", id);
    setBusyId(null);
    setConfirmDelete(null);
    load();
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-muted" />
        <CardTitle>Mother’s medications</CardTitle>
      </div>
      <p className="mt-1 text-sm text-muted">
        Track what the mother is taking — some passes into breastmilk and can
        shift stool colour (e.g. iron often makes it darker or greener). Add
        reminder times to get a phone alert.
      </p>

      {mode !== "list" ? (
        <div className="mt-4">
          <MedicationForm
            babyId={babyId}
            initial={mode === "new" ? undefined : mode.edit}
            onSaved={onSaved}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setMode("list")}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          {meds === null ? (
            <p className="mt-3 text-sm text-faint">Loading…</p>
          ) : meds.length === 0 ? (
            <p className="mt-3 text-sm text-faint">None added yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {meds.map((m) => {
                const active = isActive(m);
                return (
                  <li key={m.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{m.med_name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              active
                                ? "bg-positive-bg text-positive"
                                : "bg-surface-alt text-muted"
                            }`}
                          >
                            {active ? "Taking" : "Stopped"}
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          {m.med_dose ? `${m.med_dose} · ` : ""}since{" "}
                          {sinceLabel(m.occurred_at)}
                          {m.ended_at && ` – ${sinceLabel(m.ended_at)}`}
                        </p>
                        {m.reminder_times && m.reminder_times.length > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                            <Bell className="h-3 w-3" />
                            {m.reminder_times.join(", ")}
                          </p>
                        )}
                      </div>
                      {canEdit && confirmDelete !== m.id && (
                        <div className="flex shrink-0 items-center gap-1">
                          {active && (
                            <button
                              type="button"
                              disabled={busyId === m.id}
                              onClick={() => stop(m.id)}
                              className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-alt hover:text-ink disabled:opacity-50"
                            >
                              Stop
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Edit medication"
                            onClick={() => setMode({ edit: m })}
                            className="rounded-full p-2 text-faint hover:bg-surface-alt hover:text-ink"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete medication"
                            onClick={() => setConfirmDelete(m.id)}
                            className="rounded-full p-2 text-faint hover:bg-alert-bg hover:text-alert"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {canEdit && confirmDelete === m.id && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => remove(m.id)}
                            className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
                          >
                            {busyId === m.id ? "Deleting…" : "Delete?"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-full px-2 py-1.5 text-xs font-medium text-muted"
                          >
                            Keep
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit && (
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setMode("new")}
            >
              <Plus className="h-4 w-4" />
              Add a medication
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
