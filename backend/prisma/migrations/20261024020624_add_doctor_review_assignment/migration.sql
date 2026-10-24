-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DOCTOR_REVIEW_ASSIGNED';

-- CreateTable
CREATE TABLE "DoctorReviewAssignment" (
    "id" SERIAL NOT NULL,
    "donorProfileId" INTEGER NOT NULL,
    "doctorUserId" INTEGER NOT NULL,
    "assignedByUserId" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReviewAssignment_donorProfileId_key" ON "DoctorReviewAssignment"("donorProfileId");

-- CreateIndex
CREATE INDEX "DoctorReviewAssignment_doctorUserId_idx" ON "DoctorReviewAssignment"("doctorUserId");

-- AddForeignKey
ALTER TABLE "DoctorReviewAssignment" ADD CONSTRAINT "DoctorReviewAssignment_donorProfileId_fkey" FOREIGN KEY ("donorProfileId") REFERENCES "DonorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReviewAssignment" ADD CONSTRAINT "DoctorReviewAssignment_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReviewAssignment" ADD CONSTRAINT "DoctorReviewAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
