import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth flow schemas
// ---------------------------------------------------------------------------

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  rememberMe: z.boolean().default(true),
});

export const SignupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address")
      .max(254),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(32, "Invalid reset token").max(256),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Admin user management schemas
// ---------------------------------------------------------------------------

const ASSIGNABLE_ROLES = ["ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"] as const;

export const InviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120),
  role: z.enum(ASSIGNABLE_ROLES, {
    message: "Role must be ASSET_MANAGER, DEPARTMENT_HEAD, or EMPLOYEE",
  }),
  departmentId: z.string().cuid().optional().nullable(),
});

export const ChangeRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES, {
    message: "Role must be ASSET_MANAGER, DEPARTMENT_HEAD, or EMPLOYEE",
  }),
});

export const ChangeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    message: "Status must be ACTIVE or INACTIVE",
  }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;
export type ChangeStatusInput = z.infer<typeof ChangeStatusSchema>;

/** Minimal, client-safe view of the signed-in user (never includes credentials). */
export type NavUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ASSET_MANAGER" | "DEPARTMENT_HEAD" | "EMPLOYEE";
  status: "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE";
  orgId: string;
  departmentId: string | null;
};
