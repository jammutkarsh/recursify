import { redirect } from "next/navigation";
import { DEMO } from "@/lib/demo";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  if (DEMO) redirect("/today"); // the demo has no sign-in
  return children;
}
