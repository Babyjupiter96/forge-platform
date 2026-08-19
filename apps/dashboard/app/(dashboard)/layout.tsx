import { auth, signOut } from "@/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center justify-between border-b border-rule bg-panel-alt px-6 py-4">
        <span className="font-label text-xs uppercase tracking-[0.12em] text-ink">Forge Platform</span>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
