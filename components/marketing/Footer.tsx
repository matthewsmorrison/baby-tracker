import Link from "next/link";
import { APP_NAME, LAST_UPDATED } from "@/lib/legal";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-8 text-center">
      <p className="text-sm font-semibold">{APP_NAME}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted">
        A tracking aid for the first days and weeks — not medical advice,
        diagnosis, or a substitute for your midwife, health visitor or doctor.
      </p>
      <nav className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-xs text-faint">
        © {new Date().getFullYear()} {APP_NAME}. Last updated {LAST_UPDATED}.
      </p>
    </footer>
  );
}
