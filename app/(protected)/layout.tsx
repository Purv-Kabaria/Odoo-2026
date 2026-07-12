import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/layout/app-topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth";

/**
 * Authoritative authorization boundary for every route nested here.
 * `proxy.ts` only does a cheap cookie-presence redirect for UX; this layout
 * re-verifies the session against the database on every request, per the
 * zero-trust model in AGENTS.md. Also owns the app shell for every
 * authenticated screen: a persistent left sidebar (desktop) / off-canvas
 * sheet (mobile) for primary navigation, per the problem statement's
 * mockup, plus a slim top bar for search and live notifications.
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64">
        <Sidebar user={user} />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <AppTopbar user={user} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
