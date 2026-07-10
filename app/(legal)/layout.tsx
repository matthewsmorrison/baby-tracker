import Link from "next/link";
import { Flame } from "lucide-react";
import { Footer } from "@/components/marketing/Footer";
import { APP_NAME } from "@/lib/legal";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft">
              <Flame className="h-4 w-4 text-accent" strokeWidth={2.2} />
            </span>
            <span className="font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted hover:text-ink"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}
