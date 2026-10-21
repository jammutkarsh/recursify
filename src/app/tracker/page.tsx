import { redirect } from "next/navigation";

// Old URL from the previous version.
export default function Tracker() {
  redirect("/today");
}
