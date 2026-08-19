import { Suspense } from "react";
import { RefreshOnResume } from "@/components/shell/RefreshOnResume";
import { SWRegister } from "@/components/shell/SWRegister";
import {
  FloatingChrome,
  MobileHeaderChrome,
  SideChrome,
} from "@/components/shell/AppChrome";

/**
 * Deliberately synchronous: the layout used to await auth + queries before
 * returning any JSX, which meant nothing streamed — not even loading.tsx —
 * until every round trip finished. Now the frame flushes immediately and the
 * data-dependent chrome streams in behind Suspense.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-6 sticky top-0 h-dvh">
        <Suspense fallback={null}>
          <SideChrome />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur px-4 py-3">
          <Suspense
            fallback={
              <div className="flex h-10 items-center">
                <div className="h-6 w-28 animate-pulse rounded-full bg-surface-alt" />
              </div>
            }
          >
            <MobileHeaderChrome />
          </Suspense>
        </div>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28 md:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom bar, presence, feed-timer pill, log modal */}
      <Suspense fallback={null}>
        <FloatingChrome />
      </Suspense>

      <RefreshOnResume />
      <SWRegister />
    </div>
  );
}
