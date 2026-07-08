"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dayOfLife, STOOL_COLOURS } from "@/lib/clinical";
import { formatDateTime } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { entryLabel } from "@/lib/entryDisplay";
import { Baby, Droplets, Milk, Scale, Pencil, Trash2 } from "lucide-react";

export function EntryIcon({ entry }: { entry: Entry }) {
  const cls = "h-4 w-4";
  if (entry.type === "feed") return <Milk className={cls} />;
  if (entry.type === "weight") return <Scale className={cls} />;
  if (entry.wet && !entry.dirty) return <Droplets className={cls} />;
  return <Baby className={cls} />;
}

export function RecentEntries({
  entries,
  birthAt,
  onEdit,
  onDeleted,
}: {
  entries: Entry[];
  birthAt: string;
  onEdit: (e: Entry) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(entry: Entry) {
    setBusyId(entry.id);
    const supabase = createClient();
    if (entry.photo_path) {
      await supabase.storage.from("nappy-photos").remove([entry.photo_path]);
    }
    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    setBusyId(null);
    setConfirmId(null);
    if (!error) {
      router.refresh();
      onDeleted?.();
    }
  }

  if (entries.length === 0) return null;

  return (
    <Card className="p-5">
      <CardTitle className="mb-3">Recent entries</CardTitle>
      <ul className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-muted">
              <EntryIcon entry={e} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium flex items-center gap-2">
                {entryLabel(e)}
                {e.stool_colour && (
                  <span
                    title={STOOL_COLOURS[e.stool_colour].label}
                    className="inline-block h-3 w-3 rounded-full border border-black/10"
                    style={{ background: STOOL_COLOURS[e.stool_colour].swatch }}
                  />
                )}
              </p>
              <p className="text-xs text-muted">
                Day {dayOfLife(birthAt, e.occurred_at)} ·{" "}
                {formatDateTime(e.occurred_at)}
              </p>
            </div>
            {confirmId === e.id ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => remove(e)}
                  disabled={busyId === e.id}
                  className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
                >
                  {busyId === e.id ? "Deleting…" : "Delete?"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="text-xs font-medium text-muted"
                >
                  Keep
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Edit entry"
                  onClick={() => onEdit(e)}
                  className="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete entry"
                  onClick={() => setConfirmId(e.id)}
                  className="rounded-full p-2 text-muted hover:bg-alert-bg hover:text-alert"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
