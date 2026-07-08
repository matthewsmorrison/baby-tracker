import { redirect } from "next/navigation";

// The calendar is now the default view inside History.
export default function CalendarPage() {
  redirect("/history");
}
