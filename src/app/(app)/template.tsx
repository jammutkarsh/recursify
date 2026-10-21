// Re-mounts on every navigation inside the app, so each page fades and rises in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="h-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">{children}</div>;
}
