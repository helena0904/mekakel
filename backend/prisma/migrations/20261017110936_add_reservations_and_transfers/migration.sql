-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "DonorResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "bloodUnitId" INTEGER NOT NULL,
    "bloodRequestId" INTEGER,
    "hospitalProfileId" INTEGER NOT NULL,
    "donorProfileId" INTEGER,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "donorResponse" "DonorResponseStatus" NOT NULL DEFAULT 'PENDING',
    "donorRespondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "reason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "bloodUnitId" INTEGER NOT NULL,
    "fromHospitalProfileId" INTEGER NOT NULL,
    "toHospitalProfileId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "requestedByUserId" INTEGER NOT NULL,
    "approvedByUserId" INTEGER,
    "dispatchedByUserId" INTEGER,
    "receivedByUserId" INTEGER,
    "completedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "fromStatus" "TransferStatus",
    "toStatus" "TransferStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_bloodUnitId_idx" ON "Reservation"("bloodUnitId");

-- CreateIndex
CREATE INDEX "Reservation_hospitalProfileId_idx" ON "Reservation"("hospitalProfileId");

-- CreateIndex
CREATE INDEX "Reservation_bloodRequestId_idx" ON "Reservation"("bloodRequestId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");

-- CreateIndex
CREATE INDEX "Transfer_bloodUnitId_idx" ON "Transfer"("bloodUnitId");

-- CreateIndex
CREATE INDEX "Transfer_fromHospitalProfileId_idx" ON "Transfer"("fromHospitalProfileId");

-- CreateIndex
CREATE INDEX "Transfer_toHospitalProfileId_idx" ON "Transfer"("toHospitalProfileId");

-- CreateIndex
CREATE INDEX "Transfer_reservationId_idx" ON "Transfer"("reservationId");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "TransferEvent_transferId_idx" ON "TransferEvent"("transferId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hospitalProfileId_fkey" FOREIGN KEY ("hospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_donorProfileId_fkey" FOREIGN KEY ("donorProfileId") REFERENCES "DonorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromHospitalProfileId_fkey" FOREIGN KEY ("fromHospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toHospitalProfileId_fkey" FOREIGN KEY ("toHospitalProfileId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferEvent" ADD CONSTRAINT "TransferEvent_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
