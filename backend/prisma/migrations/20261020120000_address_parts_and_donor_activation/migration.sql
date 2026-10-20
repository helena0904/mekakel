-- CreateEnum
CREATE TYPE "DonorActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "DonorProfile"
  ADD COLUMN "subcity" TEXT,
  ADD COLUMN "wereda" TEXT,
  ADD COLUMN "activeStatus" "DonorActiveStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN "activationNotes" TEXT;

-- AlterTable
ALTER TABLE "HospitalProfile"
  ADD COLUMN "subcity" TEXT,
  ADD COLUMN "wereda" TEXT;
