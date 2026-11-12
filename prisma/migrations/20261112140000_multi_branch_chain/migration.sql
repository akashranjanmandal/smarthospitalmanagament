-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- Seed the chain's first branch: every branch-scoped record created before multi-branch existed
-- belongs here, so nothing already in the system is orphaned or hidden by the new scoping.
INSERT INTO "Branch" ("id", "name", "code", "status", "createdAt", "updatedAt")
VALUES ('branch_main_default', 'Main Branch', 'MAIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: add nullable first so existing rows can be backfilled before the column is required
ALTER TABLE "Department" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Ward" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "branchId" TEXT;
ALTER TABLE "User" ADD COLUMN "branchId" TEXT;
ALTER TABLE "RegistrationCode" ADD COLUMN "branchId" TEXT;

-- Backfill: every existing department, ward and admission belongs to the one branch that existed
-- until now. Staff (every role except PATIENT) join that branch too; patients and already-used
-- registration codes are left unscoped (null), matching their nullable, chain-wide design.
UPDATE "Department" SET "branchId" = 'branch_main_default' WHERE "branchId" IS NULL;
UPDATE "Ward" SET "branchId" = 'branch_main_default' WHERE "branchId" IS NULL;
UPDATE "Admission" SET "branchId" = 'branch_main_default' WHERE "branchId" IS NULL;
UPDATE "User" SET "branchId" = 'branch_main_default' WHERE "branchId" IS NULL AND "role" <> 'PATIENT';

-- AlterTable: now that every row has a value, these three become required
ALTER TABLE "Department" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Ward" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Admission" ALTER COLUMN "branchId" SET NOT NULL;

-- DropIndex: a department/ward name only has to be unique within its own branch now
DROP INDEX "Department_name_key";
DROP INDEX "Ward_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Department_branchId_name_key" ON "Department"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_branchId_name_key" ON "Ward"("branchId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCode" ADD CONSTRAINT "RegistrationCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
