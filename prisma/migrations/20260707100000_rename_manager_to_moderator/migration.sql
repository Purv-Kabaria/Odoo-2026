-- Rename the enum value in place rather than the destructive drop/recreate
-- Prisma would otherwise generate for an enum change: this renames the
-- value AND updates every existing row referencing it, in one metadata
-- operation, no data migration needed.
ALTER TYPE "UserRole" RENAME VALUE 'MANAGER' TO 'MODERATOR';
