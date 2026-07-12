import {
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Gauge,
  LineChart,
  Users,
  Wrench,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type NavigationLink = {
  title: string;
  href: string;
  icon: typeof Gauge;
};

const ALL_ROLES: Role[] = ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"];

export function dashboardHrefForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "ASSET_MANAGER") return "/moderator";
  return "/assets";
}

/** Admin/Asset Manager only — Department Head and Employee have no entity-registry read access. */
function organizationSetupHrefForRole(role: Role): string | null {
  if (role === "ADMIN") return "/admin";
  if (role === "ASSET_MANAGER") return "/moderator";
  return null;
}

/**
 * The sidebar's primary navigation — fixed order pulled directly from the
 * problem statement's mockup, which renders this identically on every
 * authenticated screen: Dashboard, Organization Setup, Assets, Allocation &
 * Transfer, Resource Booking, Maintenance, Audit, Reports, Notifications.
 * Account and Activity are intentionally NOT here — the mockup doesn't list
 * them as primary sidebar items (Account lives in the user menu; Activity is
 * grouped with Notifications as one screen in the brief, Screen 10).
 */
export function primaryNavigationLinksForRole(role: Role): NavigationLink[] {
  const links: NavigationLink[] = [
    { title: "Dashboard", href: dashboardHrefForRole(role), icon: Gauge },
  ];

  const orgSetupHref = organizationSetupHrefForRole(role);
  if (orgSetupHref) {
    links.push({ title: "Organization Setup", href: orgSetupHref, icon: Building2 });
  }

  links.push(
    { title: "Assets", href: "/assets", icon: Boxes },
    { title: "Allocation & Transfer", href: "/allocations", icon: Users },
    { title: "Resource Booking", href: "/bookings", icon: CalendarClock },
    { title: "Maintenance", href: "/maintenance", icon: Wrench },
    { title: "Audit", href: "/audit", icon: ClipboardCheck },
  );

  if (role === "ADMIN" || role === "ASSET_MANAGER") {
    links.push({ title: "Reports", href: "/reports", icon: LineChart });
  }

  links.push({ title: "Notifications", href: "/notifications", icon: Bell });

  return links;
}

/** Logged-out marketing footer only — an unfiltered superset, not role-scoped. */
export const marketingFeatureLinks: NavigationLink[] = [
  { title: "Assets", href: "/assets", icon: Boxes },
  { title: "Allocation & Transfer", href: "/allocations", icon: Users },
  { title: "Resource Booking", href: "/bookings", icon: CalendarClock },
  { title: "Maintenance", href: "/maintenance", icon: Wrench },
  { title: "Audit", href: "/audit", icon: ClipboardCheck },
  { title: "Reports", href: "/reports", icon: LineChart },
];

export const ALL_APP_ROLES = ALL_ROLES;
