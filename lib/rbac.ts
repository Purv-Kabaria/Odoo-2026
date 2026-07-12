import type { Role } from "@prisma/client";

/**
 * RBAC primitives for AssetFlow.
 *
 * Throws typed errors that route handlers map to 401/403 via the Api envelope.
 * Pure functions — no DB queries, no side effects — so they can be called
 * from any layer without import-order issues.
 */

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class UnauthorizedError extends Error {
  readonly statusCode = 401 as const;

  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403 as const;

  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// Minimal user shape consumed by RBAC helpers.
// Avoids coupling to the full Prisma User type — only the fields RBAC needs.
// ---------------------------------------------------------------------------

export type RbacUser = {
  id: string;
  role: Role;
  orgId: string;
  departmentId: string | null;
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Throws ForbiddenError if the user's role is not in the allowed set.
 */
export function requireRole(user: RbacUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(
      `Role '${user.role}' is not permitted. Required: ${roles.join(", ")}`,
    );
  }
}

/**
 * Department-scope guard.
 *
 * - ADMIN and ASSET_MANAGER pass unconditionally (org-wide scope).
 * - DEPARTMENT_HEAD passes only if their departmentId matches.
 * - EMPLOYEE always throws (no cross-department access).
 */
export function assertDeptScope(user: RbacUser, resourceDeptId: string | null): void {
  if (user.role === "ADMIN" || user.role === "ASSET_MANAGER") return;

  if (user.role === "DEPARTMENT_HEAD") {
    if (user.departmentId && user.departmentId === resourceDeptId) return;
    throw new ForbiddenError("Access denied: resource belongs to a different department");
  }

  throw new ForbiddenError("Access denied: insufficient department-level permissions");
}

/**
 * Ownership guard.
 *
 * - Passes if the user owns the resource (user.id === resourceOwnerId).
 * - ADMIN and ASSET_MANAGER bypass ownership checks.
 */
export function assertOwnership(user: RbacUser, resourceOwnerId: string): void {
  if (user.role === "ADMIN" || user.role === "ASSET_MANAGER") return;

  if (user.id === resourceOwnerId) return;

  throw new ForbiddenError("Access denied: you do not own this resource");
}
