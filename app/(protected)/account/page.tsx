import { redirect } from "next/navigation";

import { AccountSettingsForm } from "@/components/forms/account-settings-form";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            User panel
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Account
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage profile and password settings for your signed-in session.
          </p>
        </div>
        <Badge variant="outline" className="w-fit uppercase">
          {user.role.toLowerCase()}
        </Badge>
      </div>

      <AccountSettingsForm
        initialName={user.name}
        initialLocation={user.location}
        initialGender={user.gender}
        email={user.email}
      />
    </main>
  );
}
