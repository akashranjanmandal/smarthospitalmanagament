-- AlterTable
ALTER TABLE "Bed" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "doctorId" TEXT;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

