-- CreateEnum
CREATE TYPE "OTStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OTBooking" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "theatre" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "OTStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "cancelReason" TEXT,
    "signInAt" TIMESTAMP(3),
    "signInById" TEXT,
    "timeOutAt" TIMESTAMP(3),
    "timeOutById" TEXT,
    "signOutAt" TIMESTAMP(3),
    "signOutById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTBooking_admissionId_idx" ON "OTBooking"("admissionId");

-- CreateIndex
CREATE INDEX "OTBooking_scheduledAt_idx" ON "OTBooking"("scheduledAt");

-- AddForeignKey
ALTER TABLE "OTBooking" ADD CONSTRAINT "OTBooking_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTBooking" ADD CONSTRAINT "OTBooking_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
