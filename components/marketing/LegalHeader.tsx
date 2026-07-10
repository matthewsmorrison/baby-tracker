import { LAST_UPDATED } from "@/lib/legal";

export function LegalHeader({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {LAST_UPDATED}</p>
    </>
  );
}
