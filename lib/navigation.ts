import { Activity, Building2, Database, Gauge, Package, ShieldCheck, UserCircle, Users } from "lucide-react";
import type { Role } from "@prisma/client";

export type NavigationLink = {
  title: string;
  href: string;
  icon: typeof Gauge;
  roles: Role[];
};

export const navigationLinks: NavigationLink[] = [
  {
    title: "Admin",
    href: "/admin",
    icon: Gauge,
    roles: ["ADMIN"],
  },
  {
    title: "Moderator",
    href: "/moderator",
    icon: ShieldCheck,
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    title: "Account",
    href: "/account",
    icon: UserCircle,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Activity",
    href: "/activity",
    icon: Activity,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Storage",
    href: "/storage",
    icon: Database,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    title: "Organizations",
    href: "/organizations",
    icon: Building2,
    roles: ["ADMIN", "MODERATOR"],
  },
];

export function navigationLinksForRole(role: Role): NavigationLink[] {
  return navigationLinks.filter((link) => link.roles.includes(role));
}

export function dashboardHrefForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MODERATOR") return "/moderator";
  return "/account";
}
