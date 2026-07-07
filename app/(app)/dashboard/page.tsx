import { getBabyContext, getEntries } from "@/lib/data";
import { DISCLAIMER } from "@/lib/clinical";
import { DashboardView } from "@/components/output/DashboardView";

export default async function DashboardPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);

  return (
    <div className="space-y-4 animate-rise">
      <DashboardView
        entries={entries}
        birthAt={ctx.baby.birth_at}
        birthWeightG={ctx.baby.birth_weight_g}
      />
      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
