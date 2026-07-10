import { getBabyContext } from "@/lib/data";
import { ChatClient } from "@/components/chat/ChatClient";
import { Card } from "@/components/ui/Card";
import { Sparkles } from "lucide-react";

export default async function ChatPage() {
  const ctx = await getBabyContext();

  if (ctx.baby.membership_tier !== "advanced") {
    return (
      <Card className="p-6 text-center animate-rise">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
          <Sparkles className="h-5 w-5 text-accent" />
        </span>
        <p className="font-semibold">Bea is part of Advanced</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Advanced membership adds AI photo labelling and Bea, your assistant —
          ask anything about {ctx.baby.name}’s feeds, nappies and weight.
          Upgrades are coming soon.
        </p>
      </Card>
    );
  }

  return <ChatClient babyId={ctx.baby.id} babyName={ctx.baby.name} />;
}
