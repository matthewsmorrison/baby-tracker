import { getBabyContext } from "@/lib/data";
import { ChatClient } from "@/components/chat/ChatClient";

export default async function ChatPage() {
  const ctx = await getBabyContext();
  return <ChatClient babyName={ctx.baby.name} />;
}
