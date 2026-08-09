"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const SIZE = 256;

/** Downscale + square-crop the chosen image client-side so uploads stay tiny. */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bmp,
    (bmp.width - side) / 2,
    (bmp.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE
  );
  bmp.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("Couldn’t process that image.");
  return blob;
}

export function AvatarUpload({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const supabase = useState(() => createClient())[0];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Delete the previous upload if it lives in our avatars bucket (OAuth
   *  avatar URLs from Google etc. are external — leave those alone). */
  const removeStored = async (storedUrl: string | null) => {
    const marker = `/avatars/${userId}/`;
    const i = storedUrl?.indexOf(marker) ?? -1;
    if (storedUrl && i >= 0) {
      await supabase.storage
        .from("avatars")
        .remove([`${userId}/${storedUrl.slice(i + marker.length)}`]);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await toAvatarBlob(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      await removeStored(url);
      setUrl(data.publicUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      await removeStored(url);
      setUrl(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t remove it — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <CardTitle className="mb-1">Profile picture</CardTitle>
      <p className="mb-4 text-xs text-muted">
        Shown to your carers and friends.
      </p>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={url} size="lg" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : url ? "Change photo" : "Add a photo"}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">
          {error}
        </p>
      )}
    </Card>
  );
}
