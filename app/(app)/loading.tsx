// Shown instantly on navigation while the next page's server data loads,
// so switching tabs feels immediate instead of blocking on Supabase.
export default function Loading() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-28 animate-pulse rounded-3xl bg-surface-alt" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-3xl bg-surface-alt" />
        <div className="h-24 animate-pulse rounded-3xl bg-surface-alt" />
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-surface-alt" />
      <div className="h-40 animate-pulse rounded-3xl bg-surface-alt" />
    </div>
  );
}
