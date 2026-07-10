import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";

// Note/question photos live in the nappy-photos bucket under
// {babyId}/note-{noteId}-*.jpg — first path segment is the baby id, so the
// existing baby-scoped storage RLS and baby-deletion cleanup both apply.

export async function uploadNotePhotos(
  babyId: string,
  noteId: string,
  files: File[]
): Promise<string[]> {
  const supabase = createClient();
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const blob = await compressImage(files[i]);
    const path = `${babyId}/note-${noteId}-${Date.now()}-${i}.jpg`;
    const { error } = await supabase.storage
      .from("nappy-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}

export async function removeNotePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const supabase = createClient();
  await supabase.storage.from("nappy-photos").remove(paths);
}
