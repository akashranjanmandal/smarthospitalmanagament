-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- CreateTable
CREATE TABLE "WardAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shift" "ShiftType" NOT NULL DEFAULT 'DAY',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WardAssignment_userId_date_idx" ON "WardAssignment"("userId", "date");

-- CreateIndex
CREATE INDEX "WardAssignment_wardId_date_idx" ON "WardAssignment"("wardId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WardAssignment_userId_wardId_date_shift_key" ON "WardAssignment"("userId", "wardId", "date", "shift");
