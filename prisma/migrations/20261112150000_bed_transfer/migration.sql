-- CreateTable
CREATE TABLE "BedTransfer" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "fromBedId" TEXT NOT NULL,
    "toBedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BedTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BedTransfer_admissionId_idx" ON "BedTransfer"("admissionId");

-- AddForeignKey
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
