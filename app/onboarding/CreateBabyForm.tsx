"use client";

import { useState } from "react";
import { createBaby } from "@/lib/actions";
import { toLocalInputValue } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function CreateBabyForm() {
  // Convenience default: ~5 days ago (parents often sign up a few days in).
  const [birthAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sex, setSex] = useState<"boy" | "girl" | "">("");

  return (
    <form
      action={async (fd) => {
        setBusy(true);
        setError(null);
        try {
          await createBaby(fd);
        } catch (e) {
          setBusy(false);
          const msg = e instanceof Error ? e.message : "Something went wrong";
          // Next.js redirect() throws — let it through.
          if (msg.includes("NEXT_REDIRECT")) throw e;
          setError(msg);
        }
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="name">Baby’s name</Label>
        <Input id="name" name="name" required placeholder="e.g. Rory" />
      </div>
      <div>
        <Label htmlFor="birth_at">Date &amp; time of birth</Label>
        <Input
          id="birth_at"
          name="birth_at"
          type="datetime-local"
          required
          defaultValue={birthAt}
        />
      </div>
      <div>
        <Label htmlFor="birth_weight_g">Birth weight (g)</Label>
        <Input
          id="birth_weight_g"
          name="birth_weight_g"
          type="number"
          inputMode="numeric"
          min={500}
          max={7000}
          required
          placeholder="e.g. 3800"
        />
      </div>
      <div>
        <Label>Sex</Label>
        <input type="hidden" name="sex" value={sex} />
        <div className="grid grid-cols-2 gap-2">
          {(["boy", "girl"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sex === s}
              onClick={() => setSex(s)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                sex === s
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-faint">
          Used for the WHO weight growth centiles (boys and girls differ).
        </p>
      </div>
      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create baby"}
      </Button>
    </form>
  );
}
