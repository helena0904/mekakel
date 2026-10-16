-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'ADDITIONAL_INFO_REQUIRED';

-- AlterTable
ALTER TABLE "DonorProfile"
    ADD COLUMN "donationIntervalDays" INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN "verificationNotes" TEXT,
    ADD COLUMN "verifiedAt" TIMESTAMP(3),
    ADD COLUMN "consentToContact" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "shareLocation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DonationRecord" (
    "id" SERIAL NOT NULL,
    "donorProfileId" INTEGER NOT NULL,
    "donatedAt" TIMESTAMP(3) NOT NULL,
    "facilityName" TEXT,
    "units" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonationRecord_donorProfileId_idx" ON "DonationRecord"("donorProfileId");

-- AddForeignKey
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_donorProfileId_fkey" FOREIGN KEY ("donorProfileId") REFERENCES "DonorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
