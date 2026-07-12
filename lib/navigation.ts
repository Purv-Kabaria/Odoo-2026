import {
  Activity,
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Gauge,
  LineChart,
  ShieldCheck,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type NavigationLink = {
  title: string;
  href: string;
  icon: typeof Gauge;
  roles: Role[];
};

const ALL_ROLES: Role[] = ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"];

export const navigationLinks: NavigationLink[] = [
  {
    title: "Admin",
    href: "/admin",
    icon: Gauge,
    roles: ["ADMIN"],
  },
  {
    title: "Asset Manager",
    href: "/moderator",
    icon: ShieldCheck,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    title: "Assets",
    href: "/assets",
    icon: Boxes,
    roles: ALL_ROLES,
  },
  {
    title: "Allocation & Transfer",
    href: "/allocations",
    icon: Users,
    roles: ALL_ROLES,
  },
  {
    title: "Resource Booking",
    href: "/bookings",
    icon: CalendarClock,
    roles: ALL_ROLES,
  },
  {
    title: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
    roles: ALL_ROLES,
  },
  {
    title: "Audit",
    href: "/audit",
    icon: ClipboardCheck,
    roles: ALL_ROLES,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: LineChart,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: ALL_ROLES,
  },
  {
    title: "Account",
    href: "/account",
    icon: UserCircle,
    roles: ALL_ROLES,
  },
  {
    title: "Activity",
    href: "/activity",
    icon: Activity,
    roles: ALL_ROLES,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    title: "Organizations",
    href: "/organizations",
    icon: Building2,
    roles: ["ADMIN"],
  },
];

export function navigationLinksForRole(role: Role): NavigationLink[] {
  return navigationLinks.filter((link) => link.roles.includes(role));
}

export function dashboardHrefForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "ASSET_MANAGER") return "/moderator";
  return "/assets";
}
