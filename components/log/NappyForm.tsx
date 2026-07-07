"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import exifr from "exifr";
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
import { CameraCapture } from "./CameraCapture";
import { AiVerdict } from "@/components/output/AiVerdict";
import { Camera, Droplets, Image as ImageIcon, X } from "lucide-react";

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
  // Who picked the colour: the day/mix suggestion, the parent, or Claude.
  // Parent choices are never overwritten by analysis.
  const [colourSource, setColourSource] = useState<
    "auto" | "user" | "ai" | null
  >(
    initial?.stool_colour
      ? initial.ai?.colourKey === initial.stool_colour
        ? "ai"
        : "user"
      : null
  );
  // After the first save of a new entry, further saves update it in place.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [timeFromPhoto, setTimeFromPhoto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiAnalysis | null>(initial?.ai ?? null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // The colour to suggest for this occurred_at: day of life + feeding mix
  // over the 24h BEFORE the entry (backdating-correct).
  const suggestedColour = useMemo(() => {
    const iso = fromLocalInputValue(occurredAt);
    const day = dayOfLife(birthAt, iso);
    const mix = summariseFeeds(feedsBefore(entries, iso)).mix;
    return expectedColourKey(day, mix);
  }, [occurredAt, birthAt, entries]);

  /**
   * When a photo is chosen, read its EXIF timestamp (before compression
   * strips it) and pre-fill the "When" picker — the parent can override.
   */
  async function handlePhoto(file: File | null) {
    setPhoto(file);
    setTimeFromPhoto(false);
    if (!file) return;
    // With a photo, Claude labels the colour — drop the auto-suggestion so
    // the analysis can fill it in (a parent's own tap is kept).
    if (colourSource === "auto") {
      setColour(null);
      setColourSource(null);
    }
    try {
      const exif = await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate"],
      });
      const taken: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (
        taken instanceof Date &&
        !isNaN(taken.getTime()) &&
        taken.getTime() <= Date.now() + 60_000 &&
        taken.getFullYear() > 2000
      ) {
        setOccurredAt(toLocalInputValue(taken));
        setTimeFromPhoto(true);
      }
    } catch {
      // No usable EXIF — keep whatever the picker already shows.
    }
  }

  function toggleDirty() {
    const next = !dirty;
    setDirty(next);
    if (next && !colour && !photo) {
      // No photo to analyse — pre-select the expected colour as a starting point.
      setColour(suggestedColour);
      setColourSource("auto");
    }
    if (!next) {
      setColour(null);
      setColourSource(null);
    }
  }

  async function save() {
    if (!wet && !dirty && !photo) {
      setError("Tick wet, dirty, or both — or add a photo and Claude will label it.");
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

      let entryId = initial?.id ?? savedId ?? undefined;
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
        setSavedId(data.id);
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
          const json = (await res.json()) as {
            ai: AiAnalysis;
            stool_colour: StoolColourKey | null;
            dirty: boolean;
          };
          setAi(json.ai);
          // Reflect the AI's labelling so the chips show it and the parent
          // can correct it with a tap (parent choices are kept server-side).
          if (json.dirty && !dirty) setDirty(true);
          if (json.stool_colour && colourSource !== "user") {
            setColour(json.stool_colour);
            setColourSource("ai");
          }
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
    setColourSource(null);
    setNote("");
    setPhoto(null);
    setTimeFromPhoto(false);
    setAi(null);
    setSavedId(null);
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
                  onClick={() => {
                    setColour(key);
                    setColourSource("user");
                  }}
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
          {colourSource === "auto" && (
            <p className="mt-1.5 text-xs text-faint">
              Suggested for this day &amp; feeding mix.
            </p>
          )}
          {colourSource === "ai" && (
            <p className="mt-1.5 text-xs text-faint">
              Identified by Claude from the photo — tap another chip if that
              doesn’t look right.
            </p>
          )}
          {!colour && photo && (
            <p className="mt-1.5 text-xs text-faint">
              Claude will identify the colour from the photo when you save —
              you can correct it afterwards.
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
        {/* Camera: opens the device camera directly (capture attribute). */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
        />
        {/* Library: no capture attribute, so this opens the photo picker. */}
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
        />
        {photo ? (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm">
            <span className="truncate">{photo.name || "Camera photo"}</span>
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => {
                setPhoto(null);
                setTimeFromPhoto(false);
                if (cameraRef.current) cameraRef.current.value = "";
                if (libraryRef.current) libraryRef.current.value = "";
              }}
              className="text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (typeof navigator.mediaDevices?.getUserMedia === "function")
                  setCameraOpen(true);
                else cameraRef.current?.click();
              }}
            >
              <Camera className="h-4 w-4" />
              Take photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => libraryRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
              {initial?.photo_path ? "Replace photo" : "Upload"}
            </Button>
          </div>
        )}
        <p className="mt-1 text-xs text-faint">
          Claude checks colour &amp; consistency against this day of life and
          feeding mix. Not a diagnosis.
        </p>
      </div>

      <NoteField note={note} setNote={setNote} />
      <div>
        <OccurredAtField
          value={occurredAt}
          onChange={(v) => {
            setOccurredAt(v);
            setTimeFromPhoto(false);
          }}
        />
        {timeFromPhoto && (
          <p className="mt-1.5 rounded-2xl bg-accent-soft px-3.5 py-2 text-xs font-medium">
            Time set from the photo — adjust above if that’s not right.
          </p>
        )}
      </div>

      {ai && <AiVerdict ai={ai} />}

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={!!busy}>
        {busy ?? (initial ? "Save changes" : "Save nappy")}
      </Button>

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            // Live capture = taken right now; leave the "When" picker alone.
            setPhoto(file);
            setTimeFromPhoto(false);
            setCameraOpen(false);
          }}
          onCancel={() => setCameraOpen(false)}
          onUnavailable={() => {
            // No camera permission/device — fall back to the native capture input.
            setCameraOpen(false);
            cameraRef.current?.click();
          }}
        />
      )}
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
