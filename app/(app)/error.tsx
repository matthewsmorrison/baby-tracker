"use client";

/**
 * In-app error boundary: a Supabase hiccup or a stale chunk after a deploy
 * lands here instead of on a blank screen — with a themed retry and a hard
 * reload escape hatch (the installed PWA has no address bar to pull down).
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center">
      <div>
        <p className="text-lg font-bold">Something went wrong</p>
        <p className="mt-2 text-sm text-muted">
          Your entries are safe — this screen just failed to load.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-on-ink"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-muted"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
