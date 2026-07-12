import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser } from "@/lib/auth";

/**
 * Chrome for logged-out/marketing pages (landing, login, signup,
 * forgot/reset password) — a top navbar and footer, unlike the sidebar
 * shell authenticated screens get from app/(protected)/layout.tsx. Still
 * fetches the current user so a signed-in visitor sees a "Dashboard" link
 * instead of "Log in"/"Sign up" if they land on a public page.
 */
export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
