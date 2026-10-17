-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DONOR_VERIFICATION_DECIDED', 'HOSPITAL_REGISTRATION_DECIDED', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED', 'SETTINGS_UPDATED', 'INVENTORY_UNIT_CREATED', 'INVENTORY_UNIT_UPDATED', 'INVENTORY_UNIT_DELETED', 'RESERVATION_CREATED', 'RESERVATION_CONFIRMED', 'RESERVATION_CANCELLED', 'RESERVATION_RELEASED', 'RESERVATION_CONSUMED', 'RESERVATION_EXPIRED', 'TRANSFER_REQUESTED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'TRANSFER_DISPATCHED', 'TRANSFER_RECEIVED', 'TRANSFER_COMPLETED', 'TRANSFER_CANCELLED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
