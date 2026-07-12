import { z } from "zod";

export const ReportFiltersSchema = z.object({
  idleDays: z.coerce.number().int().min(1).max(365).default(60),
  retirementYears: z.coerce.number().int().min(1).max(50).default(5),
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const REPORT_EXPORT_KEYS = [
  "utilization-by-department",
  "maintenance-frequency",
  "most-used-assets",
  "idle-assets",
  "nearing-retirement",
  "spend-by-category",
  "booking-heatmap",
] as const;

export const REPORT_EXPORT_FORMATS = ["csv", "pdf", "docx"] as const;

export const ReportExportQuerySchema = z.object({
  report: z.enum(REPORT_EXPORT_KEYS),
  format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
  idleDays: z.coerce.number().int().min(1).max(365).default(60),
  retirementYears: z.coerce.number().int().min(1).max(50).default(5),
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;
