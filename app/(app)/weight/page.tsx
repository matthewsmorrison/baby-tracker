import { redirect } from "next/navigation";

// The Weight tab was folded into the History dashboard.
export default function WeightPage() {
  redirect("/history");
}
