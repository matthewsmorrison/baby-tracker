"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Entry, EntryType } from "@/lib/types";
import { Segmented } from "@/components/ui/Segmented";
import { Portal } from "@/components/ui/Portal";
import { NappyForm } from "./NappyForm";
import { FeedForm } from "./FeedForm";
import { WeightForm } from "./WeightForm";
import { SleepForm } from "./SleepForm";
import { Check, Plus, X } from "lucide-react";

/**
 * The Log lives in a modal opened by the floating + button on every screen.
 * It also opens for editing when a `?edit=<id>` param is present (e.g. the
 * pencil in History links to it), and clears that param on close.
 */
export function LogModal({
  babyId,
  birthAt,
  entries,
  nappyBaseWeightG,
  aiEnabled,
  trackedTypes,
}: {
  babyId: string;
  birthAt: string;
  entries: Entry[];
  nappyBaseWeightG?: number | null;
  aiEnabled: boolean;
  trackedTypes: EntryType[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");

  const TAB_LABELS: Record<EntryType, string> = {
    nappy: "Nappy",
    feed: "Feed",
    sleep: "Sleep",
    weight: "Weight",
  };
  const order: EntryType[] = ["nappy", "feed", "sleep", "weight"];
  const options = order
    .filter((t) => trackedTypes.includes(t))
    .map((t) => ({ value: t, label: TAB_LABELS[t] }));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [tab, setTab] = useState<EntryType>(options[0]?.value ?? "nappy");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deep link: ?edit=<id> opens the modal on that entry.
  useEffect(() => {
    if (!editParam) return;
    const entry = entries.find((e) => e.id === editParam);
    if (!entry) return;
    const id = window.setTimeout(() => {
      setEditing(entry);
      setTab(entry.type);
      setOpen(true);
    }, 0);
    return () => clearTimeout(id);
  }, [editParam, entries]);

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  function openNew() {
    setEditing(null);
    setTab(options[0]?.value ?? "nappy");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
    if (editParam) {
      // Drop the deep-link param without adding history noise.
      router.replace(pathname, { scroll: false });
    }
  }

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    close();
  }

  const formProps = {
    babyId,
    birthAt,
    entries,
    onDone: () => setEditing(null),
    onSaved: notify,
  };

  return (
    <>
      {/* Floating action button — every screen */}
      {!open && (
        <button
          type="button"
          onClick={openNew}
          aria-label="Log an entry"
          className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-on-ink shadow-card transition active:scale-95 right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] md:right-8 md:bottom-8"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      )}

      {open && (
        <Portal>
          <div className="fixed inset-0 z-40 flex flex-col justify-end md:items-center md:justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={close}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Log an entry"
              className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-bg shadow-card md:max-h-[88dvh] md:max-w-lg md:rounded-3xl animate-rise"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="text-base font-bold">
                  {editing ? "Edit entry" : "Log an entry"}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {options.length > 1 && (
                  <Segmented<EntryType>
                    options={options}
                    value={tab}
                    onChange={(t) => {
                      setTab(t);
                      if (editing && editing.type !== t) setEditing(null);
                    }}
                  />
                )}

                {editing && (
                  <div className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-2.5 text-sm">
                    <span className="font-medium">Editing an existing entry</span>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="font-semibold underline underline-offset-2"
                    >
                      New instead
                    </button>
                  </div>
                )}

                {tab === "nappy" && (
                  <NappyForm
                    key={editing?.id ?? "new-nappy"}
                    {...formProps}
                    initial={editing ?? undefined}
                    nappyBaseWeightG={nappyBaseWeightG}
                    aiEnabled={aiEnabled}
                  />
                )}
                {tab === "feed" && (
                  <FeedForm
                    key={editing?.id ?? "new-feed"}
                    {...formProps}
                    initial={editing ?? undefined}
                  />
                )}
                {tab === "sleep" && (
                  <SleepForm
                    key={editing?.id ?? "new-sleep"}
                    {...formProps}
                    initial={editing ?? undefined}
                  />
                )}
                {tab === "weight" && (
                  <WeightForm
                    key={editing?.id ?? "new-weight"}
                    {...formProps}
                    initial={editing ?? undefined}
                  />
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {toast && (
        <Portal>
          <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex justify-center md:bottom-6">
            <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-on-ink shadow-card animate-rise">
              <Check className="h-4 w-4 text-positive-bar" />
              {toast}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
