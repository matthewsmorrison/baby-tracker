"use client";

/**
 * Last-resort error surface. Without it, a render crash in the installed PWA
 * is an unstyled blank window with no browser chrome and no way to reload.
 * global-error replaces the root layout, so it must render <html>/<body> and
 * carry its own styling (globals.css may not have loaded).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ede9e1",
          color: "#1b1b1a",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>
            Something went wrong
          </p>
          <p style={{ marginTop: 8, fontSize: 14, color: "#8c8677" }}>
            Your entries are safe. Try again — if it keeps happening, close
            and reopen the app.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              background: "#1b1b1a",
              color: "#ede9e1",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              marginLeft: 8,
              border: "1px solid #b4ae9f",
              borderRadius: 999,
              padding: "12px 24px",
              background: "transparent",
              color: "#1b1b1a",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
