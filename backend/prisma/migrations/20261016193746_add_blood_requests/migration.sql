-- CreateEnum
CREATE TYPE "BloodComponent" AS ENUM ('WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'CRYOPRECIPITATE');

-- CreateEnum
CREATE TYPE "RequestUrgency" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "BloodUnit" ADD COLUMN     "component" "BloodComponent" NOT NULL DEFAULT 'RED_CELLS';

-- CreateTable
CREATE TABLE "BloodRequest" (
    "id" SERIAL NOT NULL,
    "hospitalProfileId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "component" "BloodComponent" NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "requiredUnits" INTEGER NOT NULL,
    "urgency" "RequestUrgency" NOT NULL DEFAULT 'ROUTINE',
    "location" TEXT,
    "notes" TEXT,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodRequest_hospitalProfileId_idx" ON "BloodRequest"("hospitalProfileId");

-- CreateIndex
CREATE INDEX "BloodRequest_status_idx" ON "BloodRequest"("status");

-- CreateIndex
CREATE INDEX "BloodRequest_bloodType_component_idx" ON "BloodRequest"("bloodType", "component");

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_hospitalProfileId_fkey" FOREIGN KEY ("hospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
