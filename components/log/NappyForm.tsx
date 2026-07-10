"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import { blobToBase64, compressImage } from "@/lib/image";
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
import type { AiAnalysis, Entry, StoolColourKey } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { OccurredAtField } from "./OccurredAtField";
import { CameraCapture } from "./CameraCapture";
import { Portal } from "@/components/ui/Portal";
import { Camera, Droplets, Image as ImageIcon, Loader2, Sparkles, X } from "lucide-react";

const COLOUR_KEYS = Object.keys(STOOL_COLOURS) as StoolColourKey[];

export function NappyForm({
  babyId,
  birthAt,
  entries,
  initial,
  onSaved,
  nappyBaseWeightG,
  aiEnabled,
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
  /** Advanced membership: photo labelling by Claude. */
  aiEnabled: boolean;
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
  const [timeFromPhoto, setTimeFromPhoto] = useState<"exif" | "file" | null>(
    null
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiAnalysis | null>(initial?.ai ?? null);
  // The analysis runs the moment a photo is chosen (Advanced only).
  const [analysing, setAnalysing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // The compressed blob analysed on upload — reused for the save upload so
  // the image is only processed once.
  const compressedRef = useRef<Blob | null>(null);
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
    setAiError(null);
    compressedRef.current = null;
    if (!file) {
      setAi(null);
      return;
    }
    // A fresh photo replaces any earlier analysis.
    setAi(null);
    // With a photo, Claude labels the colour — drop the auto-suggestion so
    // the analysis can fill it in (a parent's own tap is kept).
    if (aiEnabled && colourSource === "auto") {
      setColour(null);
      setColourSource(null);
    }

    const plausible = (d: Date | null): d is Date =>
      !!d &&
      !isNaN(d.getTime()) &&
      d.getTime() <= Date.now() + 60_000 &&
      d.getFullYear() > 2000;

    let taken: Date | null = null;
    let source: "exif" | "file" | null = null;
    try {
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
    // The time to analyse against: the photo's own time if we found one,
    // otherwise whatever the picker currently shows.
    let analysisTimeIso = fromLocalInputValue(occurredAt);
    if (plausible(taken)) {
      setOccurredAt(toLocalInputValue(taken));
      setTimeFromPhoto(source);
      analysisTimeIso = taken.toISOString();
    }

    if (aiEnabled) analysePhoto(file, analysisTimeIso);
  }

  /**
   * Send the freshly-chosen photo to Claude for labelling straight away, so
   * the colour, size and a plain-language summary are ready before saving.
   * Non-blocking: a failure just leaves the parent to set labels by hand.
   */
  async function analysePhoto(file: File, occurredAtIso: string) {
    setAnalysing(true);
    setAiError(null);
    try {
      const blob = await compressImage(file);
      compressedRef.current = blob;
      const imageBase64 = await blobToBase64(blob);
      const res = await fetch("/api/nappy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          occurredAt: occurredAtIso,
          imageBase64,
          mediaType: "image/jpeg",
          nappyWeightG: parseInt(nappyWeight, 10) || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The photo couldn't be analysed.");
      }
      const { ai: result } = (await res.json()) as { ai: AiAnalysis };
      setAi(result);
      // A visible stool means a mixed nappy; reflect it (the parent can undo).
      if (
        result.visibleContents === "poo" ||
        result.visibleContents === "both" ||
        (result.stoolAmount && result.stoolAmount !== "none")
      ) {
        setDirty(true);
        setWet(true);
      }
      // Show the identified colour unless the parent has already chosen one.
      if (result.colourKey && result.colourKey !== "unclear" && colourSource !== "user") {
        setColour(result.colourKey as StoolColourKey);
        setColourSource("ai");
      }
    } catch (e) {
      setAiError(
        e instanceof Error
          ? e.message
          : "The photo couldn't be analysed — you can set the labels by hand."
      );
    } finally {
      setAnalysing(false);
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
    if (!colour && !photo) {
      // No photo to analyse — pre-select the expected colour as a starting point.
      setColour(suggestedColour);
      setColourSource("auto");
    }
  }

  async function save() {
    if (!wet && !dirty && !photo) {
      setError("Tick wet, dirty, or both — or add a photo and Claude will label it.");
      return;
    }
    if (analysing) {
      setError("Hold on — Claude is still analysing the photo.");
      return;
    }
    setError(null);
    setBusy("Saving…");
    const supabase = createClient();

    try {
      const hasNewPhoto = !!photo;
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
        // The analysis already ran on upload — persist it with the entry.
        ai,
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
        const blob = compressedRef.current ?? (await compressImage(photo));
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
      const msg = initial
        ? "Changes saved"
        : hasNewPhoto && ai
          ? "Nappy saved — labelled from the photo"
          : "Nappy saved";
      resetForm();
      onSaved(msg);
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
    setAi(null);
    setAnalysing(false);
    setAiError(null);
    compressedRef.current = null;
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
              Suggested for this day &amp; feeding mix.
            </p>
          )}
          {colourSource === "ai" && (
            <p className="mt-1.5 text-xs text-faint">
              Identified by Claude from the photo — tap another chip if that
              doesn’t look right.
            </p>
          )}
          {!colour && photo && aiEnabled && (
            <p className="mt-1.5 text-xs text-faint">
              {analysing
                ? "Claude is identifying the colour from the photo…"
                : "Tap a chip to set the colour by hand."}
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
          {aiEnabled
            ? "Claude labels the colour and contents from the photo — every label can be changed."
            : "Photos are kept with the entry for your records."}
        </p>

        {/* Analysis runs the moment a photo is chosen (Advanced). */}
        {analysing && (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-surface-alt px-4 py-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            AI is analysing the photo…
          </div>
        )}
        {!analysing && aiError && (
          <p className="mt-3 rounded-2xl bg-surface-alt px-4 py-3 text-xs text-muted">
            {aiError}
          </p>
        )}
        {!analysing && ai && <AiSummary ai={ai} />}
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

      <Button
        className="w-full"
        size="lg"
        onClick={save}
        disabled={!!busy || analysing}
      >
        {busy ??
          (analysing
            ? "Analysing photo…"
            : initial
              ? "Save changes"
              : "Save nappy")}
      </Button>

      {cameraOpen && (
        <Portal>
        <CameraCapture
          onCapture={(file) => {
            // Live capture = taken right now; leave the "When" picker alone,
            // but still kick off the analysis just like an upload does.
            setCameraOpen(false);
            setPhoto(file);
            setTimeFromPhoto(null);
            setAi(null);
            setAiError(null);
            compressedRef.current = null;
            if (aiEnabled) analysePhoto(file, fromLocalInputValue(occurredAt));
          }}
          onCancel={() => setCameraOpen(false)}
          onUnavailable={() => {
            // No camera permission/device — fall back to the native capture input.
            setCameraOpen(false);
            cameraRef.current?.click();
          }}
        />
        </Portal>
      )}
    </Card>
  );
}

const SIZE_LABEL: Record<string, string> = {
  smaller: "smaller than a £2 coin",
  similar: "about a £2 coin",
  bigger: "bigger than a £2 coin",
};
const MATCH_LABEL: Record<string, string> = {
  yes: "colour matches the feeding pattern",
  partly: "colour roughly matches feeding",
  no: "colour differs from the feeding pattern",
};

/**
 * A calm, factual read of the photo: colour, size against a £2 coin, and
 * whether the colour matches the feeding pattern. Deliberately descriptive,
 * not a verdict — any real concern (pale/blood) surfaces via the colour
 * warning above, not here.
 */
function AiSummary({ ai }: { ai: AiAnalysis }) {
  const chips: string[] = [];
  if (ai.colourKey && ai.colourKey !== "unclear") {
    chips.push(STOOL_COLOURS[ai.colourKey as StoolColourKey].label.toLowerCase());
  }
  if (ai.sizeVs2pCoin && SIZE_LABEL[ai.sizeVs2pCoin]) {
    chips.push(SIZE_LABEL[ai.sizeVs2pCoin]);
  }
  if (ai.matchesExpected && MATCH_LABEL[ai.matchesExpected]) {
    chips.push(MATCH_LABEL[ai.matchesExpected]);
  }

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface-alt px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Sparkles className="h-3.5 w-3.5" />
        Claude’s read of the photo
      </div>
      {ai.summary && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{ai.summary}</p>
      )}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-full border border-line bg-surface px-2.5 py-1 font-medium text-muted"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-faint">
        A description to help you track — not medical advice. Correct any label
        above if it doesn’t look right.
      </p>
    </div>
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
