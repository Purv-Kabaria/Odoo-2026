import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(254),
  role: z.enum(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']).default('EMPLOYEE'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
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
  id: z.string().cuid('Invalid user identifier'),
});

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}
