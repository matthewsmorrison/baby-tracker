import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBabyContext } from "@/lib/data";
import { ChatThread } from "@/components/friends/ChatThread";
import type { DirectMessage, Profile } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FriendChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getBabyContext();
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/friends");

  const supabase = await createClient();

  // Only accepted friends have a thread.
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester.eq.${ctx.userId},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${ctx.userId})`
    )
    .maybeSingle();
  if (!friendship) redirect("/friends");

  const [{ data: profile }, { data: messages }, { data: settings }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender.eq.${ctx.userId},recipient.eq.${id}),and(sender.eq.${id},recipient.eq.${ctx.userId})`
        )
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("user_settings")
        .select("read_receipts")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
    ]);
  if (!profile) redirect("/friends");

  return (
    <ChatThread
      me={ctx.userId}
      friend={profile as Profile}
      initialMessages={(messages ?? []) as DirectMessage[]}
      friendshipId={friendship.id}
      myReceiptsOn={settings?.read_receipts !== false}
    />
  );
}
