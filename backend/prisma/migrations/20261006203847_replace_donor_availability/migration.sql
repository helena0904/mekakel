/*
  Warnings:

  - You are about to drop the column `availabilityDate` on the `DonorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `availabilityHour` on the `DonorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `availabilityPeriod` on the `DonorProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "DonorProfile" DROP COLUMN "availabilityDate",
DROP COLUMN "availabilityHour",
DROP COLUMN "availabilityPeriod";

-- CreateTable
CREATE TABLE "DonorAvailabilitySchedule" (
    "id" SERIAL NOT NULL,
    "donorProfileId" INTEGER NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorAvailabilitySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonorAvailabilitySchedule_donorProfileId_day_key" ON "DonorAvailabilitySchedule"("donorProfileId", "day");

-- AddForeignKey
ALTER TABLE "DonorAvailabilitySchedule" ADD CONSTRAINT "DonorAvailabilitySchedule_donorProfileId_fkey" FOREIGN KEY ("donorProfileId") REFERENCES "DonorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
