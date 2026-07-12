import { redirect } from "next/navigation";

import { BookingWorkspace } from "@/components/pages/booking-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <BookingWorkspace isManager={user.role !== "EMPLOYEE"} />;
}
