-- AlterTable
ALTER TABLE "BloodUnit"
  ADD COLUMN "screenedBy" INTEGER,
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "DonorProfile"
  ADD COLUMN "matchingOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reservation"
  ADD COLUMN "kind" "ReservationKind" NOT NULL DEFAULT 'BLOOD_UNIT',
  ALTER COLUMN "bloodUnitId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DonorProfile_faydaId_key" ON "DonorProfile"("faydaId");

-- CreateIndex
CREATE INDEX "Reservation_donorProfileId_idx" ON "Reservation"("donorProfileId");

-- A blood unit or donor may only have one open reservation at a time.
CREATE UNIQUE INDEX "Reservation_active_blood_unit_key"
  ON "Reservation"("bloodUnitId")
  WHERE "bloodUnitId" IS NOT NULL
    AND "status" IN ('ACTIVE', 'CONFIRMED');

CREATE UNIQUE INDEX "Reservation_active_donor_key"
  ON "Reservation"("donorProfileId")
  WHERE "donorProfileId" IS NOT NULL
    AND "status" IN ('ACTIVE', 'CONFIRMED');

-- Every reservation must target a blood unit or a donor, and the kind must
-- match the target that was supplied.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_target_check"
  CHECK ("bloodUnitId" IS NOT NULL OR "donorProfileId" IS NOT NULL);

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_kind_target_check"
  CHECK (
    ("kind" = 'BLOOD_UNIT' AND "bloodUnitId" IS NOT NULL)
    OR ("kind" = 'DONOR' AND "bloodUnitId" IS NULL AND "donorProfileId" IS NOT NULL)
  );
