import type { Role } from '@prisma/client';

/** Minimal, DB-decoupled shape the RBAC helpers actually need. */
export type RbacUser = {
  id: string;
  role: Role;
  orgId: string;
  departmentId: string | null;
};

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Throws if `user.role` isn't one of the allowed roles. */
export function requireRole(user: RbacUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(`Requires one of: ${roles.join(', ')}`);
  }
}

/** Admin/Asset Manager bypass; a Department Head must own the department; anyone else is denied. */
export function assertDeptScope(user: RbacUser, resourceDeptId: string | null): boolean {
  if (user.role === 'ADMIN' || user.role === 'ASSET_MANAGER') return true;
  if (user.role === 'DEPARTMENT_HEAD') return resourceDeptId !== null && resourceDeptId === user.departmentId;
  return false;
}

/** Admin/Asset Manager bypass; otherwise the resource must belong to the caller. */
export function assertOwnership(user: RbacUser, resourceOwnerId: string): boolean {
  if (user.role === 'ADMIN' || user.role === 'ASSET_MANAGER') return true;
  return user.id === resourceOwnerId;
}
