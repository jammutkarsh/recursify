import { redirect } from "next/navigation";
import { preload } from "react-dom";
import { AppShell } from "@/components/app/AppShell";
import { AppDataProvider } from "@/context/AppData";
import { isSignedIn } from "@/lib/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect("/login");
  // Start the data request from <head> so it runs alongside the JS download; AppDataProvider's fetch picks it up.
  preload("/api/data", { as: "fetch", crossOrigin: "anonymous" });
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
