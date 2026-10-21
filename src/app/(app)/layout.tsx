import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { AppDataProvider } from "@/context/AppData";
import { isSignedIn } from "@/lib/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect("/login");
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
