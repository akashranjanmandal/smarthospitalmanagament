-- CreateEnum
CREATE TYPE "PharmacyOrderSource" AS ENUM ('OPD', 'IPD');

-- CreateEnum
CREATE TYPE "PharmacyOrderStatus" AS ENUM ('RECEIVED', 'PREPARING', 'READY', 'DISPENSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicationOrderStatus" AS ENUM ('ACTIVE', 'STOPPED');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('GIVEN', 'HELD', 'REFUSED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PHARMACIST';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "allergies" TEXT;

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "strength" TEXT,
    "form" TEXT NOT NULL,
    "schedule" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "reorderLevel" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "source" "PharmacyOrderSource" NOT NULL,
    "status" "PharmacyOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT,
    "admissionId" TEXT,
    "medicationOrderId" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "preparedById" TEXT,
    "readyAt" TIMESTAMP(3),
    "dispensedById" TEXT,
    "dispensedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "medicineId" TEXT,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "gstRate" DOUBLE PRECISION,
    "substitutedFrom" TEXT,
    "substituteReason" TEXT,
    "allocations" JSONB,

    CONSTRAINT "PharmacyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationOrder" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "instructions" TEXT,
    "status" "MedicationOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderedById" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "stoppedById" TEXT,
    "stopReason" TEXT,

    CONSTRAINT "MedicationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAdministration" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "doseDate" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "status" "DoseStatus" NOT NULL,
    "notes" TEXT,
    "givenById" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_name_key" ON "Medicine"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockBatch_medicineId_batchNumber_key" ON "StockBatch"("medicineId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyOrder_orderNumber_key" ON "PharmacyOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyOrder_prescriptionId_key" ON "PharmacyOrder"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyOrder_medicationOrderId_key" ON "PharmacyOrder"("medicationOrderId");

-- CreateIndex
CREATE INDEX "PharmacyOrder_status_idx" ON "PharmacyOrder"("status");

-- CreateIndex
CREATE INDEX "MedicationOrder_admissionId_status_idx" ON "MedicationOrder"("admissionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationAdministration_orderId_doseDate_slot_key" ON "MedicationAdministration"("orderId", "doseDate", "slot");

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrderItem" ADD CONSTRAINT "PharmacyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PharmacyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrderItem" ADD CONSTRAINT "PharmacyOrderItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MedicationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter formulary (sample prices per unit in INR — the pharmacy should review before go-live). Stock is received separately.
INSERT INTO "Medicine" ("id", "name", "genericName", "strength", "form", "schedule", "unitPrice", "gstRate", "reorderLevel", "active", "createdAt", "updatedAt") VALUES
  ('med_dolo650',   'Dolo 650',        'Paracetamol',            '650 mg',        'TABLET',    'OTC', 2.0,  12, 200, true, now(), now()),
  ('med_pcm_iv',    'Paracetamol IV',  'Paracetamol',            '1 g / 100 ml',  'INFUSION',  'H',   180,  12, 30,  true, now(), now()),
  ('med_mox500',    'Mox 500',         'Amoxicillin',            '500 mg',        'CAPSULE',   'H',   8.0,  12, 100, true, now(), now()),
  ('med_augmentin', 'Augmentin 625',   'Amoxicillin + Clavulanic acid', '625 mg', 'TABLET',    'H',   22,   12, 100, true, now(), now()),
  ('med_azee500',   'Azee 500',        'Azithromycin',           '500 mg',        'TABLET',    'H',   25,   12, 60,  true, now(), now()),
  ('med_cefx',      'Taxim-O 200',     'Cefixime',               '200 mg',        'TABLET',    'H',   12,   12, 60,  true, now(), now()),
  ('med_ctx',       'Monocef 1 g',     'Ceftriaxone',            '1 g',           'INJECTION', 'H',   60,   12, 40,  true, now(), now()),
  ('med_pan40',     'Pan 40',          'Pantoprazole',           '40 mg',         'TABLET',    'H',   6.5,  12, 200, true, now(), now()),
  ('med_ondem',     'Emeset 4',        'Ondansetron',            '4 mg',          'TABLET',    'H',   5.0,  12, 100, true, now(), now()),
  ('med_brufen',    'Brufen 400',      'Ibuprofen',              '400 mg',        'TABLET',    'OTC', 1.5,  12, 100, true, now(), now()),
  ('med_ecosprin',  'Ecosprin 75',     'Aspirin',                '75 mg',         'TABLET',    'OTC', 0.5,  12, 200, true, now(), now()),
  ('med_clopilet',  'Clopilet 75',     'Clopidogrel',            '75 mg',         'TABLET',    'H',   5.0,  12, 100, true, now(), now()),
  ('med_atorva',    'Atorva 10',       'Atorvastatin',           '10 mg',         'TABLET',    'H',   6.0,  12, 100, true, now(), now()),
  ('med_telma',     'Telma 40',        'Telmisartan',            '40 mg',         'TABLET',    'H',   8.0,  12, 100, true, now(), now()),
  ('med_glycomet',  'Glycomet 500',    'Metformin',              '500 mg',        'TABLET',    'H',   1.5,  12, 200, true, now(), now()),
  ('med_insulin',   'Actrapid 40 IU/ml','Insulin (regular)',      '10 ml vial',    'INJECTION', 'H',   160,  12, 20,  true, now(), now()),
  ('med_warf',      'Warf 5',          'Warfarin',               '5 mg',          'TABLET',    'H',   4.0,  12, 50,  true, now(), now()),
  ('med_ns500',     'Normal saline 500 ml', 'Sodium chloride 0.9%', '500 ml',     'INFUSION',  'H',   60,   12, 100, true, now(), now()),
  ('med_rl500',     'Ringer lactate 500 ml', 'Ringer lactate',   '500 ml',        'INFUSION',  'H',   65,   12, 100, true, now(), now()),
  ('med_ors',       'Electral ORS',    'Oral rehydration salts', '21.8 g sachet', 'POWDER',    'OTC', 22,   12, 100, true, now(), now())
ON CONFLICT ("name") DO NOTHING;
