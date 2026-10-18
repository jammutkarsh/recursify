import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import { TrackerProvider } from "../../context/TrackerContext";
import Navbar from "../../components/Navbar";

export const metadata = {
  title: "Tracker | LeetCode Tracker",
};

export default async function TrackerLayout({ children }) {
  if (!(await isSignedIn())) redirect("/login");

  return (
    <TrackerProvider>
      <Navbar />
      <main id="main-content">{children}</main>
    </TrackerProvider>
  );
}
