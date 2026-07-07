"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import {
  STOOL_COLOURS,
  dayOfLife,
  expectedColourKey,
  feedsBefore,
  summariseFeeds,
} from "@/lib/clinical";
import type { AiAnalysis, Entry, StoolColourKey } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { AiVerdict } from "@/components/output/AiVerdict";
import { Camera, Droplets, X } from "lucide-react";

const COLOUR_KEYS = Object.keys(STOOL_COLOURS) as StoolColourKey[];

export function NappyForm({
  babyId,
  birthAt,
  entries,
  initial,
  onDone,
}: {
  babyId: string;
  birthAt: string;
  entries: Entry[];
  initial?: Entry;
  onDone: () => void;
}) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [wet, setWet] = useState(initial?.wet ?? false);
  const [dirty, setDirty] = useState(initial?.dirty ?? false);
  const [colour, setColour] = useState<StoolColourKey | null>(
    initial?.stool_colour ?? null
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiAnalysis | null>(initial?.ai ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The colour to suggest for this occurred_at: day of life + feeding mix
  // over the 24h BEFORE the entry (backdating-correct).
  const suggestedColour = useMemo(() => {
    const iso = fromLocalInputValue(occurredAt);
    const day = dayOfLife(birthAt, iso);
    const mix = summariseFeeds(feedsBefore(entries, iso)).mix;
    return expectedColourKey(day, mix);
  }, [occurredAt, birthAt, entries]);

  function toggleDirty() {
    const next = !dirty;
    setDirty(next);
    if (next && !colour) setColour(suggestedColour);
    if (!next) setColour(null);
  }

  async function save() {
    if (!wet && !dirty) {
      setError("Tick wet, dirty, or both.");
      return;
    }
    setError(null);
    setBusy("Saving…");
    const supabase = createClient();

    try {
      const row = {
        baby_id: babyId,
        type: "nappy" as const,
        occurred_at: fromLocalInputValue(occurredAt),
        wet,
        dirty,
        stool_colour: dirty ? colour : null,
        note: note.trim() || null,
      };

      let entryId = initial?.id;
      if (entryId) {
        const { error } = await supabase
          .from("entries")
          .update(row)
          .eq("id", entryId);
        if (error) throw new Error(error.message);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("entries")
          .insert({ ...row, created_by: user!.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        entryId = data.id;
      }

      let hasNewPhoto = false;
      if (photo) {
        setBusy("Uploading photo…");
        const blob = await compressImage(photo);
        const path = `${babyId}/${entryId}.jpg`;
        const { error: upError } = await supabase.storage
          .from("nappy-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upError) throw new Error(upError.message);
        const { error } = await supabase
          .from("entries")
          .update({ photo_path: path })
          .eq("id", entryId);
        if (error) throw new Error(error.message);
        hasNewPhoto = true;
      }

      // Analyse when there's a photo: always for new photos, and on edit the
      // context (occurred_at / feeding mix) may have changed.
      if (hasNewPhoto || (initial?.photo_path && initial)) {
        setBusy("Asking Claude to check the photo…");
        const res = await fetch(`/api/entries/${entryId}/analyze`, {
          method: "POST",
        });
        if (res.ok) {
          const json = (await res.json()) as { ai: AiAnalysis };
          setAi(json.ai);
        } else if (hasNewPhoto) {
          const body = await res.json().catch(() => null);
          setError(
            body?.error ??
              "The photo was saved but analysis failed — you can retry from Recent entries."
          );
        }
      }

      router.refresh();
      if (!hasNewPhoto && !initial?.photo_path) {
        // No verdict to show — reset for the next quick entry.
        resetForm();
        onDone();
      } else {
        setPhoto(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function resetForm() {
    setWet(false);
    setDirty(false);
    setColour(null);
    setNote("");
    setPhoto(null);
    setAi(null);
    setOccurredAt(toLocalInputValue(new Date()));
  }

  const warnColour = colour && STOOL_COLOURS[colour].warn;

  return (
    <Card className="p-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Wet"
          active={wet}
          onClick={() => setWet(!wet)}
          icon={<Droplets className="h-4 w-4" />}
        />
        <Toggle
          label="Dirty"
          active={dirty}
          onClick={toggleDirty}
          icon={<span aria-hidden>💩</span>}
        />
      </div>
      <p className="text-xs text-faint -mt-2">
        One nappy that’s both = tick both.
      </p>

      {dirty && (
        <div>
          <Label>Stool colour</Label>
          <div className="flex flex-wrap gap-2">
            {COLOUR_KEYS.map((key) => {
              const c = STOOL_COLOURS[key];
              const active = colour === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColour(key)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface-alt text-muted hover:text-ink"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10"
                    style={{ background: c.swatch }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
          {colour === suggestedColour && (
            <p className="mt-1.5 text-xs text-faint">
              Suggested for this day &amp; feeding mix.
            </p>
          )}
          {warnColour && (
            <p className="mt-2 rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert">
              {colour === "pale"
                ? "Pale, white or chalky stool always needs checking — contact your midwife or GP today."
                : "Blood in the nappy always needs checking — seek advice today."}
            </p>
          )}
        </div>
      )}

      <div>
        <Label>Photo (optional)</Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {photo ? (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm">
            <span className="truncate">{photo.name}</span>
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => {
                setPhoto(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {initial?.photo_path ? "Replace photo" : "Add a photo for an AI check"}
          </Button>
        )}
        <p className="mt-1 text-xs text-faint">
          Claude checks colour &amp; consistency against this day of life and
          feeding mix. Not a diagnosis.
        </p>
      </div>

      <NoteField note={note} setNote={setNote} />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      {ai && <AiVerdict ai={ai} />}

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={!!busy}>
        {busy ?? (initial ? "Save changes" : "Save nappy")}
      </Button>
    </Card>
  );
}

export function Toggle({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold transition ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface-alt text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function NoteField({
  note,
  setNote,
}: {
  note: string;
  setNote: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="note">Note (optional)</Label>
      <textarea
        id="note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-base text-ink placeholder:text-faint focus:border-ink focus:outline-none resize-none"
        placeholder="Anything worth remembering"
      />
    </div>
  );
}
