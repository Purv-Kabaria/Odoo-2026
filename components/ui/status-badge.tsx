import * as React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  Clock,
  HelpCircle,
  Loader2,
  Minus,
  RotateCcw,
  SearchX,
  Sparkles,
  Trash2,
  UserCog,
  UserRound,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { humanizeEnum } from "@/lib/labels";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/**
 * Every status/priority/verification/condition enum in the schema, paired
 * with a color variant and an icon that reinforces meaning beyond text
 * alone — this is the single place that maps a raw Prisma enum string to
 * what a user actually sees, replacing the several near-duplicate
 * `statusVariant()`/`priorityVariant()` helpers that used to live
 * per-page (each of which left the label un-humanized).
 */
export type StatusBadgeKind =
  | "assetStatus"
  | "assetCondition"
  | "allocationStatus"
  | "transferStatus"
  | "bookingStatus"
  | "maintenanceStatus"
  | "maintenancePriority"
  | "auditCycleStatus"
  | "auditVerification";

type StatusConfig = { variant: BadgeVariant; icon: LucideIcon };

const CONFIG: Record<StatusBadgeKind, Record<string, StatusConfig>> = {
  assetStatus: {
    AVAILABLE: { variant: "secondary", icon: CheckCircle2 },
    ALLOCATED: { variant: "default", icon: UserRound },
    RESERVED: { variant: "default", icon: CalendarClock },
    UNDER_MAINTENANCE: { variant: "outline", icon: Wrench },
    LOST: { variant: "destructive", icon: SearchX },
    RETIRED: { variant: "outline", icon: Archive },
    DISPOSED: { variant: "destructive", icon: Trash2 },
  },
  assetCondition: {
    NEW: { variant: "secondary", icon: Sparkles },
    GOOD: { variant: "secondary", icon: CheckCircle2 },
    FAIR: { variant: "outline", icon: CircleDot },
    POOR: { variant: "outline", icon: AlertTriangle },
    DAMAGED: { variant: "destructive", icon: AlertOctagon },
  },
  allocationStatus: {
    ACTIVE: { variant: "default", icon: CheckCircle2 },
    RETURNED: { variant: "secondary", icon: RotateCcw },
  },
  transferStatus: {
    REQUESTED: { variant: "outline", icon: Clock },
    APPROVED: { variant: "default", icon: CheckCircle2 },
    REJECTED: { variant: "destructive", icon: XCircle },
    COMPLETED: { variant: "secondary", icon: CheckCheck },
    CANCELLED: { variant: "outline", icon: Ban },
  },
  bookingStatus: {
    UPCOMING: { variant: "outline", icon: CalendarClock },
    ONGOING: { variant: "default", icon: CircleDot },
    COMPLETED: { variant: "secondary", icon: CheckCheck },
    CANCELLED: { variant: "outline", icon: Ban },
  },
  maintenanceStatus: {
    PENDING: { variant: "outline", icon: Clock },
    APPROVED: { variant: "default", icon: CheckCircle2 },
    REJECTED: { variant: "destructive", icon: XCircle },
    TECHNICIAN_ASSIGNED: { variant: "default", icon: UserCog },
    IN_PROGRESS: { variant: "default", icon: Loader2 },
    RESOLVED: { variant: "secondary", icon: CheckCheck },
  },
  maintenancePriority: {
    LOW: { variant: "secondary", icon: ArrowDown },
    MEDIUM: { variant: "default", icon: Minus },
    HIGH: { variant: "destructive", icon: ArrowUp },
    URGENT: { variant: "destructive", icon: AlertTriangle },
  },
  auditCycleStatus: {
    PLANNED: { variant: "outline", icon: CalendarClock },
    IN_PROGRESS: { variant: "default", icon: Loader2 },
    CLOSED: { variant: "secondary", icon: CheckCircle2 },
  },
  auditVerification: {
    PENDING: { variant: "outline", icon: Clock },
    VERIFIED: { variant: "secondary", icon: CheckCircle2 },
    MISSING: { variant: "destructive", icon: HelpCircle },
    DAMAGED: { variant: "destructive", icon: AlertOctagon },
  },
};

export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: StatusBadgeKind;
  status: string;
  className?: string;
}) {
  const config = CONFIG[kind]?.[status];
  const Icon = config?.icon;
  return (
    <Badge variant={config?.variant ?? "outline"} className={className}>
      {Icon && <Icon data-icon="inline-start" className={status === "IN_PROGRESS" ? "animate-spin" : undefined} />}
      {humanizeEnum(status)}
    </Badge>
  );
}
