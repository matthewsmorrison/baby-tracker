"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  STOOL_COLOURS,
  nappyOutputG,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { entryLabel, feedAmounts } from "@/lib/entryDisplay";
import { formatTime } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import {
  Baby,
  BedDouble,
  ChevronRight,
  Droplet,
  Droplets,
  Milk,
  Moon,
  Pencil,
  Pill,
  Scale,
  Star,
  Thermometer,
  Trash2,
  X,
} from "lucide-react";

export function EntryIcon({ entry }: { entry: Entry }) {
  const cls = "h-4 w-4";
  if (entry.type === "feed") return <Milk className={cls} />;
  if (entry.type === "weight") return <Scale className={cls} />;
  if (entry.type === "sleep") return <Moon className={cls} />;
  if (entry.type === "carer_sleep") return <BedDouble className={cls} />;
  if (entry.type === "pump") return <Droplet className={cls} />;
  if (entry.type === "medication") return <Pill className={cls} />;
  if (entry.type === "temperature") return <Thermometer className={cls} />;
  if (entry.type === "milestone") return <Star className={cls} />;
  if (entry.wet && !entry.dirty) return <Droplets className={cls} />;
  return <Baby className={cls} />;
}

/** Local-date key, e.g. "2026-07-04". */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * One read-only entry row, expandable: nappies reveal the colour, photo and
 * AI verdict; weights reveal % vs birth.
 */
export function EntryRow({
  entry,
  photoUrl,
  birthWeightG,
  canEdit,
  onPhotoClick,
  nappyBaseWeightG,
}: {
  entry: Entry;
  photoUrl?: string;
  birthWeightG: number;
  canEdit: boolean;
  onPhotoClick: (url: string) => void;
  nappyBaseWeightG?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const supabase = createClient();
    if (entry.photo_path) {
      await supabase.storage.from("nappy-photos").remove([entry.photo_path]);
    }
    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (!error) router.refresh();
  }

  const expandable =
    (entry.type === "nappy" &&
      (entry.stool_colour || photoUrl || entry.nappy_weight_g)) ||
    (entry.type === "feed" && (entry.feed_notes || entry.ended_at)) ||
    entry.type === "weight";
  const ws =
    entry.type === "weight" && entry.weight_g
      ? weightStatus(entry.weight_g, birthWeightG)
      : null;

  return (
    <li>
      <div className="flex items-start gap-1 py-3.5">
      <button
        type="button"
        onClick={() => expandable && setOpen(!open)}
        className={`flex min-w-0 flex-1 items-start gap-3 text-left ${
          expandable ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={expandable ? open : undefined}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Nappy photo — tap to enlarge"
            className="h-10 w-10 shrink-0 cursor-zoom-in rounded-xl object-cover border border-line"
            onClick={(e) => {
              e.stopPropagation();
              onPhotoClick(photoUrl);
            }}
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-muted">
            <EntryIcon entry={entry} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{entryLabel(entry)}</p>
            {entry.stool_colour && (
              <span
                title={STOOL_COLOURS[entry.stool_colour].label}
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                style={{ background: STOOL_COLOURS[entry.stool_colour].swatch }}
              />
            )}
          </div>
          <p className="text-xs text-muted">
            {formatTime(entry.occurred_at)}
            {entry.ended_at && ` – ${formatTime(entry.ended_at)}`}
            {entry.nappy_weight_g && ` · ${entry.nappy_weight_g} g`}
          </p>
          {entry.note && (
            <p className="mt-1 text-xs text-muted italic">“{entry.note}”</p>
          )}
        </div>
        {expandable && (
          <ChevronRight
            className={`mt-1 h-4 w-4 shrink-0 text-faint transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        )}
      </button>
      {canEdit && !confirmDelete && (
        <>
          <Link
            href={`?edit=${entry.id}`}
            aria-label="Edit this entry in Log"
            className="rounded-full p-2 text-faint hover:bg-surface-alt hover:text-ink"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label="Delete this entry"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full p-2 text-faint hover:bg-alert-bg hover:text-alert"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
      {canEdit && confirmDelete && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={deleting}
            onClick={remove}
            className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
          >
            {deleting ? "Deleting…" : "Delete?"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-full px-2 py-1.5 text-xs font-medium text-muted"
          >
            Keep
          </button>
        </div>
      )}
      </div>

      {open && (
        <div className="pb-4 space-y-3" style={{ paddingLeft: 52 }}>
          {entry.type === "feed" && (
            <div className="space-y-1.5">
              {(
                [
                  ["left", "Left breast", "min"],
                  ["right", "Right breast", "min"],
                  ["expressed", "Expressed", "ml"],
                  ["formula", "Formula", "ml"],
                ] as const
              ).map(([key, label, unit]) => {
                const amount = feedAmounts(entry)[key];
                const rowNote = entry.feed_notes?.[key];
                if (!amount && !rowNote) return null;
                return (
                  <div key={key} className="text-sm">
                    <span className="font-medium">{label}:</span>{" "}
                    {amount ? `${amount} ${unit}` : "—"}
                    {rowNote && (
                      <span className="text-muted italic"> — “{rowNote}”</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {entry.type === "nappy" && entry.nappy_weight_g && (
            <p className="text-sm">
              <span className="font-medium">Nappy weight:</span>{" "}
              {entry.nappy_weight_g} g
              {(() => {
                const out = nappyOutputG(entry.nappy_weight_g, nappyBaseWeightG);
                return out !== null
                  ? ` — ≈ ${out} g of output vs the dry nappy`
                  : "";
              })()}
            </p>
          )}
          {entry.type === "nappy" && entry.stool_colour && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-5 w-5 rounded-full border border-black/10"
                style={{ background: STOOL_COLOURS[entry.stool_colour].swatch }}
              />
              {STOOL_COLOURS[entry.stool_colour].label}
            </div>
          )}
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Nappy photo — tap to enlarge"
              className="max-h-56 cursor-zoom-in rounded-2xl border border-line object-contain"
              onClick={() => onPhotoClick(photoUrl)}
            />
          )}
          {ws && (
            <p
              className={`text-sm font-semibold stat-num ${
                ws.tone === "positive"
                  ? "text-positive"
                  : ws.tone === "alert"
                    ? "text-alert"
                    : ws.tone === "watch"
                      ? "text-watch"
                      : "text-ink"
              }`}
            >
              {ws.pct >= 0 ? "+" : ""}
              {ws.pct.toFixed(1)}% vs birth
              <span className="ml-2 font-normal text-muted text-xs">
                {ws.message}
              </span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function DayTotals({ entries }: { entries: Entry[] }) {
  const nappies = entries.filter((e) => e.type === "nappy");
  const wet = nappies.filter((e) => e.wet).length;
  const dirty = nappies.filter((e) => e.dirty).length;
  const feeds = summariseFeeds(entries);
  return (
    <p className="text-xs text-muted">
      {wet} wet · {dirty} dirty · {feeds.sessions} feeds
      {feeds.formulaMl > 0 && ` · ${feeds.formulaMl} ml formula`}
    </p>
  );
}

/** Full-screen photo viewer; render at the page root. */
export function PhotoLightbox({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  if (!url) return null;
  return (
    <Portal>
    <div
      role="dialog"
      aria-label="Nappy photo, enlarged"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={url}
        alt="Nappy photo enlarged"
        className="max-h-[90vh] max-w-full rounded-2xl object-contain"
      />
      <button
        type="button"
        aria-label="Close"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-white/10 p-2.5 text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
    </Portal>
  );
}
