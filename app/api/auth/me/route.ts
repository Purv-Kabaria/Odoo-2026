import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Api.unauthorized("Not signed in");
  }

  return Api.ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      orgId: user.orgId,
      departmentId: user.departmentId,
    },
  });
}
