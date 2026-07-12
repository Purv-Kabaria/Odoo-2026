import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Api.unauthorized("Not signed in");
  }

  return Api.ok({ user });
}
