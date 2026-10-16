-- CreateEnum
CREATE TYPE "HospitalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "HospitalStaffRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BloodUnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'DISCARDED');

-- AlterTable
ALTER TABLE "HospitalProfile"
    ADD COLUMN "status" "HospitalStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "reviewNotes" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "reviewedByUserId" INTEGER;

-- CreateTable
CREATE TABLE "HospitalStaffMember" (
    "id" SERIAL NOT NULL,
    "hospitalProfileId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "staffRole" "HospitalStaffRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalStaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnit" (
    "id" SERIAL NOT NULL,
    "hospitalProfileId" INTEGER NOT NULL,
    "bagId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "screeningStatus" "ScreeningStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "status" "BloodUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "storageLocation" TEXT,
    "storageNotes" TEXT,
    "screenedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalStaffMember_userId_key" ON "HospitalStaffMember"("userId");

-- CreateIndex
CREATE INDEX "HospitalStaffMember_hospitalProfileId_idx" ON "HospitalStaffMember"("hospitalProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodUnit_hospitalProfileId_bagId_key" ON "BloodUnit"("hospitalProfileId", "bagId");

-- CreateIndex
CREATE INDEX "BloodUnit_hospitalProfileId_idx" ON "BloodUnit"("hospitalProfileId");

-- CreateIndex
CREATE INDEX "BloodUnit_hospitalProfileId_bloodType_idx" ON "BloodUnit"("hospitalProfileId", "bloodType");

-- CreateIndex
CREATE INDEX "BloodUnit_expiryDate_idx" ON "BloodUnit"("expiryDate");

-- AddForeignKey
ALTER TABLE "HospitalStaffMember" ADD CONSTRAINT "HospitalStaffMember_hospitalProfileId_fkey" FOREIGN KEY ("hospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalStaffMember" ADD CONSTRAINT "HospitalStaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_hospitalProfileId_fkey" FOREIGN KEY ("hospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
