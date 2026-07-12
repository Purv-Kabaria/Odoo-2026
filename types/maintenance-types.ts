import { z } from "zod";

export const MaintenanceRequestCreateSchema = z.object({
  assetId: z.string().uuid(),
  description: z.string().trim().min(2).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  photoUrl: z.string().url().max(2048).optional().nullable(),
});

export const MaintenanceAssignSchema = z.object({
  technicianId: z.string().uuid(),
});

export const MaintenanceResolveSchema = z.object({
  resolutionNotes: z.string().trim().max(1000).optional().nullable(),
});

export type MaintenanceRequestCreateInput = z.infer<typeof MaintenanceRequestCreateSchema>;
