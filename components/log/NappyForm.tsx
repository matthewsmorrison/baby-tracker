"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import {
  NAPPY_WET_THRESHOLD_G,
  STOOL_COLOURS,
  dayOfLife,
  expectedColourKey,
  feedsBefore,
  nappyOutputG,
  summariseFeeds,
} from "@/lib/clinical";
import type { Entry, StoolColourKey } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { CameraCapture } from "./CameraCapture";
import { Portal } from "@/components/ui/Portal";
import { Camera, Droplets, Image as ImageIcon, X } from "lucide-react";

const COLOUR_KEYS = Object.keys(STOOL_COLOURS) as StoolColourKey[];

export function NappyForm({
  babyId,
  birthAt,
  entries,
  initial,
  onSaved,
  nappyBaseWeightG,
}: {
  babyId: string;
  birthAt: string;
  entries: Entry[];
  initial?: Entry;
  onDone?: () => void;
  /** Confirm a successful save (snackbar) and close any edit state. */
  onSaved: (message: string) => void;
  /** Dry nappy weight from Profile — enables wetness inference. */
  nappyBaseWeightG?: number | null;
}) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() =>
    initial
      ? toLocalInputValue(new Date(initial.occurred_at))
      : toLocalInputValue(new Date())
  );
  const [wet, setWet] = useState(initial?.wet ?? false);
  const [dirty, setDirty] = useState(initial?.dirty ?? false);
  const [nappyWeight, setNappyWeight] = useState(
    initial?.nappy_weight_g?.toString() ?? ""
  );
  const wetFromWeight = useRef(false);
  const [colour, setColour] = useState<StoolColourKey | null>(
    initial?.stool_colour ?? null
  );
  // Who picked the colour: the day/mix suggestion or the parent.
  const [colourSource, setColourSource] = useState<"auto" | "user" | null>(
    initial?.stool_colour ? "user" : null
  );
  // After the first save of a new entry, further saves update it in place.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [timeFromPhoto, setTimeFromPhoto] = useState<"exif" | "file" | null>(
    null
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
   * When a photo is chosen, work out when it was taken (before compression
   * strips metadata) and pre-fill the "When" picker — the parent can override.
   *
   * EXIF datetimes are timezone-naive wall-clock strings, so we parse the raw
   * string ourselves as local time rather than trusting any library
   * conversion. When there's no EXIF at all (iOS/macOS often strip it while
   * transcoding HEIC library picks), fall back to the file's lastModified,
   * which survives transcoding and is the capture time for library photos.
   */
  async function handlePhoto(file: File | null) {
    setPhoto(file);
    setTimeFromPhoto(null);
    if (!file) return;

    const plausible = (d: Date | null): d is Date =>
      !!d &&
      !isNaN(d.getTime()) &&
      d.getTime() <= Date.now() + 60_000 &&
      d.getFullYear() > 2000;

    let taken: Date | null = null;
    let source: "exif" | "file" | null = null;
    try {
      // The mini build (EXIF/TIFF only) is a third the size of the default
      // full build, and loading it on demand keeps EXIF parsing out of the
      // form bundle entirely — it's only needed when a photo is attached.
      // @ts-expect-error — exifr ships no types for the dist subpaths.
      const { default: exifr } = await import("exifr/dist/mini.esm.mjs");
      const tags = await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
        reviveValues: false,
      });
      const raw: unknown =
        tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate;
      if (typeof raw === "string") {
        // "2026:07:06 15:20:00" (or ISO-ish) → local wall-clock time
        const m = raw.match(
          /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
        );
        if (m) {
          taken = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
          source = "exif";
        }
      } else if (raw instanceof Date) {
        taken = raw;
        source = "exif";
      }
    } catch {
      // Unreadable metadata — fall through to the file timestamp.
    }

    if (!plausible(taken)) {
      taken = new Date(file.lastModified);
      source = "file";
    }
    if (plausible(taken)) {
      setOccurredAt(toLocalInputValue(taken));
      setTimeFromPhoto(source);
    }
  }

  /** Weighing the nappy tells us if it's wet: 1 g ≈ 1 ml of wee. */
  function handleNappyWeight(v: string) {
    setNappyWeight(v);
    const g = parseInt(v, 10);
    const output = nappyOutputG(Number.isFinite(g) ? g : null, nappyBaseWeightG);
    if (output === null) return;
    if (output >= NAPPY_WET_THRESHOLD_G) {
      if (!wet) {
        setWet(true);
        wetFromWeight.current = true;
      }
    } else if (wetFromWeight.current) {
      // Only undo what the weight itself set — never a parent's tap.
      setWet(false);
      wetFromWeight.current = false;
    }
  }

  const nappyOutput = nappyOutputG(
    parseInt(nappyWeight, 10) || null,
    nappyBaseWeightG
  );

  // A nappy is either "wet only" or "mixed" (poo, with wee assumed).
  function chooseWet() {
    setWet(true);
    setDirty(false);
    setColour(null);
    setColourSource(null);
  }
  function chooseMixed() {
    setDirty(true);
    setWet(true); // poo nappy is assumed to have wee too
    if (!colour) {
      // Pre-select the expected colour for this day & feeding mix as a start.
      setColour(suggestedColour);
      setColourSource("auto");
    }
  }

  async function save() {
    if (!wet && !dirty && !photo) {
      setError("Tick wet, dirty, or both — or add a photo.");
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
        nappy_weight_g: (() => {
          const g = parseInt(nappyWeight, 10);
          return Number.isFinite(g) && g > 0 ? g : null;
        })(),
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
      }

      router.refresh();
      resetForm();
      onSaved(initial ? "Changes saved" : "Nappy saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function resetForm() {
    setWet(false);
    setDirty(false);
    setNappyWeight("");
    wetFromWeight.current = false;
    setColour(null);
    setColourSource(null);
    setNote("");
    setPhoto(null);
    setTimeFromPhoto(null);
    setSavedId(null);
    setOccurredAt(toLocalInputValue(new Date()));
  }

  const warnColour = colour && STOOL_COLOURS[colour].warn;

  return (
    <Card className="p-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Wet only"
          active={wet && !dirty}
          onClick={chooseWet}
          icon={<Droplets className="h-4 w-4" />}
        />
        <Toggle
          label="Mixed"
          active={dirty}
          onClick={chooseMixed}
          icon={<span aria-hidden>💩</span>}
        />
      </div>
      <p className="text-xs text-faint -mt-2">
        <span className="font-medium text-muted">Wet only</span> = just wee.{" "}
        <span className="font-medium text-muted">Mixed</span> = a nappy with poo
        (we assume it has wee too).
      </p>

      <div>
        <Label htmlFor="nappy_weight">Nappy weight (optional, g)</Label>
        <Input
          id="nappy_weight"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          placeholder={
            nappyBaseWeightG ? `dry nappy is ${nappyBaseWeightG} g` : "e.g. 78"
          }
          value={nappyWeight}
          onChange={(e) => handleNappyWeight(e.target.value)}
        />
        {nappyOutput !== null ? (
          <p
            className={`mt-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium ${
              nappyOutput >= NAPPY_WET_THRESHOLD_G
                ? "bg-positive-bg text-positive"
                : "bg-surface-alt text-muted"
            }`}
          >
            ≈ {nappyOutput} g of output vs the {nappyBaseWeightG} g dry nappy
            {nappyOutput >= NAPPY_WET_THRESHOLD_G
              ? " — marked wet (untick if that’s wrong)."
              : " — too little to count as wet."}
          </p>
        ) : (
          !nappyBaseWeightG &&
          nappyWeight && (
            <p className="mt-1 text-xs text-faint">
              Set the dry nappy weight in Settings and wetness will be inferred
              automatically.
            </p>
          )
        )}
      </div>

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
                      ? "border-ink bg-ink text-on-ink"
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
              Suggested for this day &amp; feeding mix — tap to change.
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
                handlePhoto(null);
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
          Photos are kept with the entry for your records.
        </p>
      </div>

      <NoteField note={note} setNote={setNote} />
      <div>
        <OccurredAtField
          value={occurredAt}
          onChange={(v) => {
            setOccurredAt(v);
            setTimeFromPhoto(null);
          }}
        />
        {timeFromPhoto && (
          <p className="mt-1.5 rounded-2xl bg-accent-soft px-3.5 py-2 text-xs font-medium">
            {timeFromPhoto === "exif"
              ? "Time set from the photo — adjust above if that’s not right."
              : "Time estimated from the photo’s file date — worth double-checking."}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}

      <Button className="w-full" size="lg" onClick={save} disabled={!!busy}>
        {busy ?? (initial ? "Save changes" : "Save nappy")}
      </Button>

      {cameraOpen && (
        <Portal>
          <CameraCapture
            onCapture={(file) => {
              // Live capture = taken right now; leave the "When" picker alone.
              setCameraOpen(false);
              setPhoto(file);
              setTimeFromPhoto(null);
            }}
            onCancel={() => setCameraOpen(false)}
            onUnavailable={() => {
              // No camera permission/device — fall back to the native input.
              setCameraOpen(false);
              cameraRef.current?.click();
            }}
          />
        </Portal>
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
          ? "border-ink bg-ink text-on-ink"
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
