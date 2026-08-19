// Local-time helpers for the datetime-local inputs used for backdating.

// Pinned locale: the server (Vercel, en-US) and clients (typically en-GB)
// otherwise format dates differently, which broke hydration on every page
// (React #418 → full client re-render → slow loads).
const LOCALE = "en-GB";

/** Date → value for <input type="datetime-local"> in the user's local time. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string (interpreted in local time). */
export function fromLocalInputValue(v: string): string {
  return new Date(v).toISOString();
}

/** Local-date key, e.g. "2026-07-04". Lives here (not in a component module)
 *  so importing it doesn't drag a whole entry-list UI into the bundle. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Start of the local calendar day containing `d`. */
export function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** The calendar date a given day of life started on (birth day = day 1). */
export function dayOfLifeDate(birthAt: string | Date, day: number): Date {
  return new Date(new Date(birthAt).getTime() + (day - 1) * 24 * 60 * 60 * 1000);
}

/** "Day 5 · Sat 5 Jul" — a day of life is always shown with its real date. */
export function dayWithDate(birthAt: string | Date, day: number): string {
  return `Day ${day} · ${dayOfLifeDate(birthAt, day).toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}
