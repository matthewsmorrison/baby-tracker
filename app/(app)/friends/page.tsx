import { getBabyContext } from "@/lib/data";
import { getFriendsData } from "@/lib/friends";
import { FriendsClient } from "@/components/friends/FriendsClient";

export default async function FriendsPage() {
  const ctx = await getBabyContext();
  const data = await getFriendsData(ctx.userId);
  return <FriendsClient data={data} />;
}
