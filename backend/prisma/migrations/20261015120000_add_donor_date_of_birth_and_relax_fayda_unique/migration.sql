-- AlterTable
ALTER TABLE "DonorProfile" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

-- DropIndex
DROP INDEX "DonorProfile_faydaId_key";
