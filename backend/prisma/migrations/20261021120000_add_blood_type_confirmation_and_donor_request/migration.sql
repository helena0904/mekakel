-- Blood type confirmation is tracked independently from screening. Existing
-- units that were already clinically confirmed are backfilled so they keep
-- their current availability.
ALTER TABLE "BloodUnit"
ADD COLUMN "bloodTypeConfirmed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "BloodUnit"
SET "bloodTypeConfirmed" = true
WHERE "confirmationStatus" = 'CONFIRMED';

ALTER TYPE "NotificationType" ADD VALUE 'DONOR_BLOOD_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'DONOR_BLOOD_REQUESTED';
