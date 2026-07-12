-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AuditCycleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditVerification" AS ENUM ('PENDING', 'VERIFIED', 'MISSING', 'DAMAGED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSET_ASSIGNED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'MAINTENANCE_APPROVED', 'MAINTENANCE_REJECTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'OVERDUE_RETURN', 'AUDIT_DISCREPANCY');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "assetSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headId" TEXT,
    "parentDepartmentId" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldSchema" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "qrCode" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(14,2),
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "location" TEXT,
    "photoUrl" TEXT,
    "documents" JSONB,
    "isBookable" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "toEmployeeId" TEXT,
    "toDepartmentId" TEXT,
    "allocatedById" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnCondition" "AssetCondition",
    "checkInNotes" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "onBehalfOfDeptId" TEXT,
    "title" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'UPCOMING',
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "technicianId" TEXT,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PENDING',
    "photoUrl" TEXT,
    "resolutionNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCycle" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeDeptId" TEXT,
    "scopeLocation" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AuditCycleStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAssignment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditItem" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "verification" "AuditVerification" NOT NULL DEFAULT 'PENDING',
    "auditedById" TEXT,
    "notes" TEXT,
    "auditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscrepancyReport" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscrepancyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");

-- CreateIndex
CREATE INDEX "User_orgId_status_idx" ON "User"("orgId", "status");

-- CreateIndex
CREATE INDEX "Department_orgId_idx" ON "Department"("orgId");

-- CreateIndex
CREATE INDEX "Department_headId_idx" ON "Department"("headId");

-- CreateIndex
CREATE INDEX "Department_parentDepartmentId_idx" ON "Department"("parentDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_orgId_name_key" ON "Department"("orgId", "name");

-- CreateIndex
CREATE INDEX "AssetCategory_orgId_idx" ON "AssetCategory"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_orgId_name_key" ON "AssetCategory"("orgId", "name");

-- CreateIndex
CREATE INDEX "Asset_orgId_idx" ON "Asset"("orgId");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_orgId_status_idx" ON "Asset"("orgId", "status");

-- CreateIndex
CREATE INDEX "Asset_orgId_status_createdAt_idx" ON "Asset"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_orgId_location_idx" ON "Asset"("orgId", "location");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_orgId_assetTag_key" ON "Asset"("orgId", "assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_orgId_serialNumber_key" ON "Asset"("orgId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_qrCode_key" ON "Asset"("qrCode");

-- CreateIndex
CREATE INDEX "Allocation_assetId_idx" ON "Allocation"("assetId");

-- CreateIndex
CREATE INDEX "Allocation_toEmployeeId_idx" ON "Allocation"("toEmployeeId");

-- CreateIndex
CREATE INDEX "Allocation_toDepartmentId_idx" ON "Allocation"("toDepartmentId");

-- CreateIndex
CREATE INDEX "Allocation_allocatedById_idx" ON "Allocation"("allocatedById");

-- CreateIndex
CREATE INDEX "Allocation_assetId_allocatedAt_idx" ON "Allocation"("assetId", "allocatedAt");

-- CreateIndex
CREATE INDEX "TransferRequest_assetId_idx" ON "TransferRequest"("assetId");

-- CreateIndex
CREATE INDEX "TransferRequest_toEmployeeId_idx" ON "TransferRequest"("toEmployeeId");

-- CreateIndex
CREATE INDEX "TransferRequest_requestedById_idx" ON "TransferRequest"("requestedById");

-- CreateIndex
CREATE INDEX "TransferRequest_status_createdAt_idx" ON "TransferRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_bookedById_idx" ON "Booking"("bookedById");

-- CreateIndex
CREATE INDEX "Booking_onBehalfOfDeptId_idx" ON "Booking"("onBehalfOfDeptId");

-- CreateIndex
CREATE INDEX "Booking_assetId_startTime_idx" ON "Booking"("assetId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_status_startTime_idx" ON "Booking"("status", "startTime");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assetId_idx" ON "MaintenanceRequest"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_raisedById_idx" ON "MaintenanceRequest"("raisedById");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_technicianId_idx" ON "MaintenanceRequest"("technicianId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_createdAt_idx" ON "MaintenanceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditCycle_orgId_idx" ON "AuditCycle"("orgId");

-- CreateIndex
CREATE INDEX "AuditCycle_createdById_idx" ON "AuditCycle"("createdById");

-- CreateIndex
CREATE INDEX "AuditCycle_orgId_status_idx" ON "AuditCycle"("orgId", "status");

-- CreateIndex
CREATE INDEX "AuditAssignment_cycleId_idx" ON "AuditAssignment"("cycleId");

-- CreateIndex
CREATE INDEX "AuditAssignment_auditorId_idx" ON "AuditAssignment"("auditorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAssignment_cycleId_auditorId_key" ON "AuditAssignment"("cycleId", "auditorId");

-- CreateIndex
CREATE INDEX "AuditItem_cycleId_idx" ON "AuditItem"("cycleId");

-- CreateIndex
CREATE INDEX "AuditItem_assetId_idx" ON "AuditItem"("assetId");

-- CreateIndex
CREATE INDEX "AuditItem_cycleId_verification_idx" ON "AuditItem"("cycleId", "verification");

-- CreateIndex
CREATE UNIQUE INDEX "AuditItem_cycleId_assetId_key" ON "AuditItem"("cycleId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscrepancyReport_cycleId_key" ON "DiscrepancyReport"("cycleId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_createdAt_idx" ON "ActivityLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_onBehalfOfDeptId_fkey" FOREIGN KEY ("onBehalfOfDeptId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCycle" ADD CONSTRAINT "AuditCycle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCycle" ADD CONSTRAINT "AuditCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAssignment" ADD CONSTRAINT "AuditAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AuditCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAssignment" ADD CONSTRAINT "AuditAssignment_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AuditCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_auditedById_fkey" FOREIGN KEY ("auditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyReport" ADD CONSTRAINT "DiscrepancyReport_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AuditCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

