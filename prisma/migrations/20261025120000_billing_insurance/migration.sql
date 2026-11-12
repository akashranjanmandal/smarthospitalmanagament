-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('SELF', 'INSURANCE', 'CORPORATE', 'GOVERNMENT_SCHEME');

-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('ROOM', 'CONSULTATION', 'PROCEDURE', 'LAB', 'RADIOLOGY', 'PHARMACY', 'CONSUMABLE', 'NURSING', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT', 'PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "PreAuthKind" AS ENUM ('INITIAL', 'ENHANCEMENT', 'FINAL');

-- CreateEnum
CREATE TYPE "PreAuthStatus" AS ENUM ('SUBMITTED', 'QUERY', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'QUERY', 'SETTLED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INSURANCE_DESK';

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "billDiscount" DOUBLE PRECISION,
ADD COLUMN     "billFinalizedAt" TIMESTAMP(3),
ADD COLUMN     "billNumber" TEXT,
ADD COLUMN     "billRoomDays" INTEGER,
ADD COLUMN     "billRoomRate" DOUBLE PRECISION,
ADD COLUMN     "finalBillAmount" DOUBLE PRECISION,
ADD COLUMN     "insurerName" TEXT,
ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "payerType" "PayerType" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "policyNumber" TEXT,
ADD COLUMN     "policyValidTill" TIMESTAMP(3),
ADD COLUMN     "sumInsured" DOUBLE PRECISION,
ADD COLUMN     "tpaName" TEXT;

-- CreateTable
CREATE TABLE "ServiceTariff" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ChargeCategory" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionCharge" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "tariffId" TEXT,
    "description" TEXT NOT NULL,
    "category" "ChargeCategory" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "AdmissionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionPayment" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuth" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "kind" "PreAuthKind" NOT NULL,
    "status" "PreAuthStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "responseRemarks" TEXT,
    "requestedById" TEXT,
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PreAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "claimedAmount" DOUBLE PRECISION NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "settledAmount" DOUBLE PRECISION,
    "deductions" JSONB,
    "utrNumber" TEXT,
    "remarks" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTariff_code_key" ON "ServiceTariff"("code");

-- CreateIndex
CREATE INDEX "AdmissionCharge_admissionId_idx" ON "AdmissionCharge"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPayment_receiptNumber_key" ON "AdmissionPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "AdmissionPayment_admissionId_idx" ON "AdmissionPayment"("admissionId");

-- CreateIndex
CREATE INDEX "PreAuth_admissionId_idx" ON "PreAuth"("admissionId");

-- CreateIndex
CREATE INDEX "PreAuth_status_idx" ON "PreAuth"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_admissionId_key" ON "InsuranceClaim"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_claimNumber_key" ON "InsuranceClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "InsuranceClaim_status_idx" ON "InsuranceClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_billNumber_key" ON "Admission"("billNumber");

-- AddForeignKey
ALTER TABLE "AdmissionCharge" ADD CONSTRAINT "AdmissionCharge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCharge" ADD CONSTRAINT "AdmissionCharge_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "ServiceTariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPayment" ADD CONSTRAINT "AdmissionPayment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuth" ADD CONSTRAINT "PreAuth_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter price list (sample rates in INR — review and adjust in Admin → Tariffs before go-live)
INSERT INTO "ServiceTariff" ("id", "code", "name", "category", "price", "gstRate", "active", "createdAt", "updatedAt") VALUES
  ('tariff_bed_general',  'BED-GENERAL',      'General ward bed (per day)',        'ROOM',         1500, 0, true, now(), now()),
  ('tariff_bed_semi',     'BED-SEMI_PRIVATE', 'Semi-private room (per day)',       'ROOM',         3000, 0, true, now(), now()),
  ('tariff_bed_private',  'BED-PRIVATE',      'Private room (per day)',            'ROOM',         5000, 0, true, now(), now()),
  ('tariff_bed_icu',      'BED-ICU',          'ICU bed (per day)',                 'ROOM',        12000, 0, true, now(), now()),
  ('tariff_bed_nicu',     'BED-NICU',         'NICU bed (per day)',                'ROOM',        10000, 0, true, now(), now()),
  ('tariff_bed_er',       'BED-EMERGENCY',    'Emergency bed (per day)',           'ROOM',         2500, 0, true, now(), now()),
  ('tariff_bed_maternity','BED-MATERNITY',    'Maternity bed (per day)',           'ROOM',         3000, 0, true, now(), now()),
  ('tariff_cons_visit',   'CONS-VISIT',       'Consultant ward visit',             'CONSULTATION',  800, 0, true, now(), now()),
  ('tariff_cons_icu',     'CONS-ICU',         'Intensivist visit',                 'CONSULTATION', 1500, 0, true, now(), now()),
  ('tariff_nursing_day',  'NURS-DAY',         'Nursing care (per day)',            'NURSING',       600, 0, true, now(), now()),
  ('tariff_lab_cbc',      'LAB-CBC',          'Complete blood count (CBC)',        'LAB',           350, 0, true, now(), now()),
  ('tariff_lab_plt',      'LAB-PLT',          'Platelet count',                    'LAB',           250, 0, true, now(), now()),
  ('tariff_lab_lft',      'LAB-LFT',          'Liver function test',               'LAB',           700, 0, true, now(), now()),
  ('tariff_lab_kft',      'LAB-KFT',          'Kidney function test',              'LAB',           650, 0, true, now(), now()),
  ('tariff_lab_dengue',   'LAB-DENGUE',       'Dengue NS1 antigen',                'LAB',           900, 0, true, now(), now()),
  ('tariff_rad_xray',     'RAD-XRAY-CHEST',   'X-ray chest PA view',               'RADIOLOGY',     450, 0, true, now(), now()),
  ('tariff_rad_usg',      'RAD-USG-ABD',      'Ultrasound abdomen',                'RADIOLOGY',    1500, 0, true, now(), now()),
  ('tariff_rad_ecg',      'RAD-ECG',          'ECG',                               'RADIOLOGY',     300, 0, true, now(), now()),
  ('tariff_proc_ivcan',   'PROC-IV-CANNULA',  'IV cannulation',                    'PROCEDURE',     300, 0, true, now(), now()),
  ('tariff_cons_ivset',   'CONS-IV-SET',      'IV infusion set',                   'CONSUMABLE',    150, 12, true, now(), now()),
  ('tariff_pharm_ns',     'PHARM-NS-500',     'Normal saline 500 ml',              'PHARMACY',       60, 12, true, now(), now()),
  ('tariff_pharm_pcm',    'PHARM-PCM-IV',     'Paracetamol IV 1 g',                'PHARMACY',      180, 12, true, now(), now())
ON CONFLICT ("code") DO NOTHING;
