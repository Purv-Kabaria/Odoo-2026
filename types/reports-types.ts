import { z } from 'zod';

/**
 * Shared across every /api/reports/* route so filters behave identically
 * everywhere and the frontend can build one query string for all widgets.
 */
export const ReportFiltersSchema = z.object({
  departmentId: z.uuid().optional(),
  category: z.string().trim().max(80).optional(),
  status: z
    .enum([
      'AVAILABLE',
      'ALLOCATED',
      'RESERVED',
      'UNDER_MAINTENANCE',
      'LOST',
      'RETIRED',
      'DISPOSED',
    ])
    .optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  idleDays: z.coerce.number().int().min(1).max(365).default(60),
  retirementYears: z.coerce.number().int().min(1).max(50).default(5),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;

export const REPORT_EXPORT_KEYS = [
  'department-summary',
  'audit-trend',
  'asset-activity-most-audited',
  'asset-activity-idle',
  'maintenance-outlook-retirement',
  'maintenance-outlook-flagged',
  'spend-by-category',
  'auditor-performance',
] as const;

export type ReportExportKey = (typeof REPORT_EXPORT_KEYS)[number];
