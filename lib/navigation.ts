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
    title: "Dashboard",
    href: "/dashboard",
    icon: Gauge,
    roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  },
  {
    title: "Assets",
    href: "/assets",
    icon: Package,
    roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  },
  {
    title: "Departments",
    href: "/departments",
    icon: Building2,
    roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"],
  },
  {
    title: "Maintenance",
    href: "/maintenance",
    icon: ShieldCheck,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    title: "Account",
    href: "/account",
    icon: UserCircle,
    roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  },
  {
    title: "Activity",
    href: "/activity",
    icon: Activity,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
];

export function navigationLinksForRole(role: Role): NavigationLink[] {
  return navigationLinks.filter((link) => link.roles.includes(role));
}

export function dashboardHrefForRole(role: Role): string {
  return "/dashboard";
}
