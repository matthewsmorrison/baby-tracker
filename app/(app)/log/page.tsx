import { redirect } from "next/navigation";

// The Log moved into a modal opened by the + button on every screen.
// Preserve old edit deep-links by forwarding the param to Today.
export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  redirect(edit ? `/today?edit=${edit}` : "/today");
}
