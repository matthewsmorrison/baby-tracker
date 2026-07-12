"use client";

import { useState } from "react";
import { createProfessional } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function ProfessionalForm({ defaultName }: { defaultName?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setBusy(true);
        setError(null);
        try {
          await createProfessional(fd);
        } catch (e) {
          setBusy(false);
          const msg = e instanceof Error ? e.message : "Something went wrong";
          if (msg.includes("NEXT_REDIRECT")) throw e;
          setError(msg);
        }
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="pname">Your name</Label>
        <Input
          id="pname"
          name="name"
          required
          defaultValue={defaultName}
          placeholder="e.g. Sarah Whitfield"
        />
      </div>
      <div>
        <Label htmlFor="ptitle">Title / role</Label>
        <Input
          id="ptitle"
          name="title"
          required
          placeholder="e.g. IBCLC Lactation Consultant"
        />
      </div>
      <div>
        <Label htmlFor="ploc">Location (optional)</Label>
        <Input id="ploc" name="location" placeholder="e.g. Bristol, UK" />
      </div>
      <div>
        <Label htmlFor="pweb">Website (optional)</Label>
        <Input id="pweb" name="website" placeholder="e.g. yourpractice.co.uk" />
      </div>
      <div>
        <Label htmlFor="pbio">About you (optional)</Label>
        <textarea
          id="pbio"
          name="bio"
          rows={3}
          className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-base placeholder:text-faint focus:border-ink focus:outline-none resize-none"
          placeholder="How you support families in the early weeks…"
        />
      </div>
      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create professional profile"}
      </Button>
    </form>
  );
}
