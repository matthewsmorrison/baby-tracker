import { getBabyContext, getEntries } from "@/lib/data";
import { LogClient } from "@/components/log/LogClient";
import { Card } from "@/components/ui/Card";
import { Eye } from "lucide-react";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await getBabyContext();
  const { edit } = await searchParams;

  if (!ctx.canEdit) {
    return (
      <Card className="p-6 text-center animate-rise">
        <Eye className="mx-auto mb-3 h-6 w-6 text-muted" />
        <p className="font-semibold">Read-only access</p>
        <p className="mt-1 text-sm text-muted">
          You have healthcare-professional access to {ctx.baby.name}: you can
          see everything in Today, Weight and History, but logging is reserved
          for carers.
        </p>
      </Card>
    );
  }

  const entries = await getEntries(ctx.baby.id);

  return (
    <LogClient
      babyId={ctx.baby.id}
      birthAt={ctx.baby.birth_at}
      entries={entries}
      editId={edit}
    />
  );
}
