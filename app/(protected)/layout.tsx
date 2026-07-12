import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * Authoritative authorization boundary for every route nested here.
 * `middleware.ts` only does a cheap cookie-presence redirect for UX;
 * this layout re-verifies the session against the database on every
 * request, per the zero-trust model in AGENTS.md.
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

  return <>{children}</>;
}
