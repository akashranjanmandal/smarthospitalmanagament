-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "consultStartedAt" TIMESTAMP(3),
ADD COLUMN     "tokenNumber" INTEGER;

