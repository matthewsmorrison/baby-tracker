"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState, useTransition } from "react";
import {
  createNote,
  deleteNote,
  editNote,
  setNoteAnswer,
  setNotePhotos,
} from "@/lib/actions";
import { uploadNotePhotos, removeNotePhotos } from "@/lib/notePhotos";
import { formatDateTime } from "@/lib/dates";
import type { BabyNote, MemberRole } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Segmented } from "@/components/ui/Segmented";
import { PhotoLightbox } from "@/components/output/entryList";
import {
  Check,
  ImagePlus,
  MessageCircleQuestion,
  Pencil,
  RotateCcw,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";

export interface TagMember {
  userId: string;
  name: string;
  role: MemberRole;
  isSelf: boolean;
}

function roleWord(role: MemberRole) {
  return role === "viewer" ? "healthcare" : role;
}

function PeoplePicker({
  members,
  selected,
  onToggle,
}: {
  members: TagMember[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = selected.includes(m.userId);
        return (
          <button
            key={m.userId}
            type="button"
            onClick={() => onToggle(m.userId)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              on
                ? "border-ink bg-ink text-on-ink"
                : "border-line bg-surface-alt text-muted hover:text-ink"
            }`}
          >
            {m.isSelf ? "You" : m.name}
            <span className={on ? "text-on-ink/60" : "text-faint"}>
              {" "}
              · {roleWord(m.role)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TaggedChips({
  ids,
  memberById,
}: {
  ids: string[];
  memberById: Map<string, TagMember>;
}) {
  if (!ids?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const m = memberById.get(id);
        return (
          <Chip key={id} tone="accent">
            {m ? (m.isSelf ? "You" : m.name) : "Someone"}
          </Chip>
        );
      })}
    </div>
  );
}

/** Thumbnail grid for existing (removable) and newly-added note photos. */
function PhotoPicker({
  files,
  setFiles,
  existing = [],
  onRemoveExisting,
  photoUrls = {},
}: {
  files: File[];
  setFiles: (f: File[]) => void;
  existing?: string[];
  onRemoveExisting?: (path: string) => void;
  photoUrls?: Record<string, string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const thumb = "h-16 w-16 rounded-xl border border-line object-cover";
  const removeBtn =
    "absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-on-ink";
  return (
    <div className="flex flex-wrap gap-2">
      {existing.map((p) =>
        photoUrls[p] ? (
          <div key={p} className="relative">
            <img src={photoUrls[p]} alt="Note photo" className={thumb} />
            {onRemoveExisting && (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onRemoveExisting(p)}
                className={removeBtn}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : null
      )}
      {files.map((f, i) => (
        <div key={i} className="relative">
          <img src={URL.createObjectURL(f)} alt="New photo" className={thumb} />
          <button
            type="button"
            aria-label="Remove photo"
            onClick={() => setFiles(files.filter((_, j) => j !== i))}
            className={removeBtn}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Add photos"
        className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line text-muted hover:border-ink hover:text-ink"
      >
        <ImagePlus className="h-5 w-5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          setFiles([...files, ...Array.from(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Composer({
  babyId,
  members,
}: {
  babyId: string;
  members: TagMember[];
}) {
  const [kind, setKind] = useState<"question" | "note">("question");
  const [body, setBody] = useState("");
  const [tagged, setTagged] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await createNote(babyId, body, tagged, kind);
      if (created.error || !created.id) {
        setError(created.error ?? "Could not save");
        return;
      }
      if (photos.length) {
        const paths = await uploadNotePhotos(babyId, created.id, photos);
        const res = await setNotePhotos(created.id, paths);
        if (res?.error) setError(res.error);
      }
      setBody("");
      setTagged([]);
      setPhotos([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <Segmented<"question" | "note">
        className="mb-3"
        options={[
          { value: "question", label: "Question" },
          { value: "note", label: "Note" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          kind === "question"
            ? "e.g. Is their weight gain on track? Should we keep topping up with formula?"
            : "e.g. Started tummy time today — seems to prefer turning left."
        }
        className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-base placeholder:text-faint focus:border-ink focus:outline-none resize-none"
      />
      {members.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-xs font-medium text-muted">
            {kind === "question" ? "Who is this for?" : "Tag anyone (optional)"}
          </p>
          <PeoplePicker members={members} selected={tagged} onToggle={toggle} />
        </>
      )}
      <p className="mt-3 mb-1.5 text-xs font-medium text-muted">
        Photos (optional)
      </p>
      <PhotoPicker files={photos} setFiles={setPhotos} />
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
      <Button
        className="mt-3 w-full"
        disabled={busy || !body.trim()}
        onClick={submit}
      >
        {busy
          ? photos.length
            ? "Saving photos…"
            : "Saving…"
          : kind === "question"
            ? "Add question"
            : "Add note"}
      </Button>
    </Card>
  );
}

function NoteCard({
  note,
  babyId,
  members,
  memberById,
  canEdit,
  advanced,
  photoUrls,
}: {
  note: BabyNote;
  babyId: string;
  members: TagMember[];
  memberById: Map<string, TagMember>;
  canEdit: boolean;
  advanced: boolean;
  photoUrls: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [answering, setAnswering] = useState(false);
  const [answerText, setAnswerText] = useState(note.answer ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  /** Bea drafts an answer from the tracked data; a human edits and saves. */
  async function draftWithBea() {
    if (drafting) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/notes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: note.id,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      setAnswerText(data.draft);
      setAnswering(true);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDrafting(false);
    }
  }
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [tagged, setTagged] = useState<string[]>(note.tagged_user_ids ?? []);
  const [keptPaths, setKeptPaths] = useState<string[]>(note.photo_paths ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveEdit() {
    const res = await editNote(note.id, body, tagged);
    if (res?.error) return; // keep the editor open; nothing was saved
    const original = note.photo_paths ?? [];
    const removed = original.filter((p) => !keptPaths.includes(p));
    let paths = keptPaths;
    if (newFiles.length) {
      const uploaded = await uploadNotePhotos(babyId, note.id, newFiles);
      paths = [...keptPaths, ...uploaded];
    }
    if (removed.length) await removeNotePhotos(removed);
    if (newFiles.length || removed.length) await setNotePhotos(note.id, paths);
    setNewFiles([]);
    setEditing(false);
  }

  const isNote = note.kind === "note";
  const answered = !!note.answer;
  const toggleTag = (id: string) =>
    setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  if (editing) {
    return (
      <Card className="p-5 space-y-3">
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-base focus:border-ink focus:outline-none resize-none"
        />
        {members.length > 0 && (
          <PeoplePicker members={members} selected={tagged} onToggle={toggleTag} />
        )}
        <PhotoPicker
          files={newFiles}
          setFiles={setNewFiles}
          existing={keptPaths}
          onRemoveExisting={(p) =>
            setKeptPaths((k) => k.filter((x) => x !== p))
          }
          photoUrls={photoUrls}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending || !body.trim()}
            onClick={() => startTransition(saveEdit)}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isNote
              ? "bg-surface-alt text-muted"
              : answered
                ? "bg-positive-bg text-positive"
                : "bg-accent-soft text-accent"
          }`}
        >
          {isNote ? (
            <StickyNote className="h-4 w-4" />
          ) : answered ? (
            <Check className="h-4 w-4" />
          ) : (
            <MessageCircleQuestion className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{note.body}</p>
          <TaggedChips ids={note.tagged_user_ids} memberById={memberById} />
          {note.photo_paths && note.photo_paths.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {note.photo_paths.map((p) =>
                photoUrls[p] ? (
                  <img
                    key={p}
                    src={photoUrls[p]}
                    alt="Note photo"
                    onClick={() => setLightbox(photoUrls[p])}
                    className="h-16 w-16 cursor-zoom-in rounded-xl border border-line object-cover"
                  />
                ) : null
              )}
            </div>
          )}
          <p className="mt-1.5 text-xs text-faint">
            {formatDateTime(note.created_at)}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Edit note"
              onClick={() => setEditing(true)}
              className="rounded-full p-2 text-faint hover:bg-surface-alt hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {confirmDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => void (await deleteNote(note.id)))}
                className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
              >
                {pending ? "…" : "Delete?"}
              </button>
            ) : (
              <button
                type="button"
                aria-label="Delete note"
                onClick={() => setConfirmDelete(true)}
                className="rounded-full p-2 text-faint hover:bg-alert-bg hover:text-alert"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Answer block */}
      {isNote ? null : answered && !answering ? (
        <div className="mt-3 rounded-2xl bg-positive-bg/60 px-4 py-3">
          <p className="text-xs font-semibold text-positive">Answer</p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap">{note.answer}</p>
          {note.answered_at && (
            <p className="mt-1 text-xs text-faint">
              recorded {formatDateTime(note.answered_at)}
            </p>
          )}
          {canEdit && (
            <div className="mt-2 flex gap-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setAnswerText(note.answer ?? "");
                  setAnswering(true);
                }}
                className="text-muted hover:text-ink"
              >
                Edit answer
              </button>
              <button
                type="button"
                onClick={() => startTransition(async () => void (await setNoteAnswer(note.id, "")))}
                className="inline-flex items-center gap-1 text-muted hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" /> Reopen
              </button>
            </div>
          )}
        </div>
      ) : canEdit && (answering || !answered) ? (
        <div className="mt-3">
          {answering || answerText ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="What did they say?"
                className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-2.5 text-sm focus:border-ink focus:outline-none resize-none"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending || !answerText.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      await setNoteAnswer(note.id, answerText);
                      setAnswering(false);
                    })
                  }
                >
                  {pending ? "Saving…" : "Save answer"}
                </Button>
                {advanced && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={drafting}
                    onClick={draftWithBea}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {drafting ? "Drafting…" : "Redraft with Bea"}
                  </Button>
                )}
                {answering && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAnswering(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {draftError && (
                <p className="text-xs text-alert">{draftError}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAnswering(true)}
                className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
              >
                + Record the answer
              </button>
              {advanced && (
                <button
                  type="button"
                  disabled={drafting}
                  onClick={draftWithBea}
                  className="inline-flex items-center gap-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {drafting ? "Bea is drafting…" : "Draft with Bea"}
                </button>
              )}
              {draftError && <p className="text-xs text-alert">{draftError}</p>}
            </div>
          )}
        </div>
      ) : null}

      <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </Card>
  );
}

export function NotesClient({
  babyId,
  canEdit,
  advanced = false,
  notes,
  members,
  photoUrls,
}: {
  babyId: string;
  canEdit: boolean;
  /** Advanced tier — enables Bea's draft answers. */
  advanced?: boolean;
  currentUserId: string;
  notes: BabyNote[];
  members: TagMember[];
  photoUrls: Record<string, string>;
}) {
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members]
  );
  const open = notes.filter((n) => n.kind !== "note" && !n.answer);
  const plainNotes = notes.filter((n) => n.kind === "note");
  const answered = notes.filter((n) => n.kind !== "note" && n.answer);

  const [showAnswered, setShowAnswered] = useState(false);

  return (
    <div className="space-y-4 animate-rise">
      {canEdit && <Composer babyId={babyId} members={members} />}

      {notes.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">
            Jot down questions before a midwife or health-visitor visit (tag
            who they’re for, record the answers), or add plain notes about how
            things are going. The Ask chat can use all of them.
          </p>
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <section className="space-y-3">
              <h2 className="px-2 text-sm font-bold">
                To ask ({open.length})
              </h2>
              {open.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  babyId={babyId}
                  members={members}
                  memberById={memberById}
                  canEdit={canEdit}
                  advanced={advanced}
                  photoUrls={photoUrls}
                />
              ))}
            </section>
          )}

          {plainNotes.length > 0 && (
            <section className="space-y-3">
              <h2 className="px-2 text-sm font-bold">Notes ({plainNotes.length})</h2>
              {plainNotes.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  babyId={babyId}
                  members={members}
                  memberById={memberById}
                  canEdit={canEdit}
                  advanced={advanced}
                  photoUrls={photoUrls}
                />
              ))}
            </section>
          )}

          {answered.length > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAnswered((v) => !v)}
                className="flex w-full items-center justify-between px-2 text-sm font-bold"
              >
                <span>Answered ({answered.length})</span>
                {showAnswered ? (
                  <X className="h-4 w-4 text-muted" />
                ) : (
                  <span className="text-xs font-medium text-muted">show</span>
                )}
              </button>
              {showAnswered &&
                answered.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    babyId={babyId}
                    members={members}
                    memberById={memberById}
                    canEdit={canEdit}
                    advanced={advanced}
                    photoUrls={photoUrls}
                  />
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
