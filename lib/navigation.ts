import { Activity, BarChart3, Bell, Boxes, Building, Building2, ClipboardCheck, Database, Gauge, Package, ShieldCheck, UserCircle, Users } from "lucide-react";
import type { UserRole } from "@prisma/client";

export type NavigationLink = {
  title: string;
  href: string;
  icon: typeof Gauge;
  roles: UserRole[];
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
  {
    title: "Departments",
    href: "/departments",
    icon: Building,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Assets",
    href: "/assets",
    icon: Boxes,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Audit",
    href: "/audit",
    icon: ClipboardCheck,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: ["ADMIN", "MODERATOR", "USER"],
  },
];

export function navigationLinksForRole(role: UserRole): NavigationLink[] {
  return navigationLinks.filter((link) => link.roles.includes(role));
}

export function dashboardHrefForRole(role: UserRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MODERATOR") return "/moderator";
  return "/account";
}
