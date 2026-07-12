import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(254),
  role: z.enum(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']).default('EMPLOYEE'),
  // PENDING_APPROVAL is the real default new rows land in (both self-signup
  // and invite now gate through it) — never a target an editor picks by
  // hand via this form, but the schema still needs to accept and default to
  // it so existing/new rows round-trip correctly.
  status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'INACTIVE']).default('PENDING_APPROVAL'),
  orgId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type UserType = z.infer<typeof UserSchema>;

export const UserWriteSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserWriteInput = z.infer<typeof UserWriteSchema>;

export const UserIdSchema = z.object({
  id: z.string().uuid('Invalid user identifier'),
});

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}
