-- CreateEnum
CREATE TYPE "LabDepartment" AS ENUM ('LAB', 'RADIOLOGY');

-- CreateEnum
CREATE TYPE "LabPriority" AS ENUM ('ROUTINE', 'URGENT');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('ORDERED', 'COLLECTED', 'RESULTED', 'VERIFIED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LAB_TECH';

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" "LabDepartment" NOT NULL,
    "sampleType" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "parameters" JSONB NOT NULL,
    "turnaroundHours" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "medicalRecordId" TEXT,
    "orderedById" TEXT,
    "priority" "LabPriority" NOT NULL DEFAULT 'ROUTINE',
    "clinicalNotes" TEXT,
    "status" "LabStatus" NOT NULL DEFAULT 'ORDERED',
    "accessionNumber" TEXT,
    "collectedAt" TIMESTAMP(3),
    "collectedById" TEXT,
    "results" JSONB,
    "reportText" TEXT,
    "abnormal" BOOLEAN NOT NULL DEFAULT false,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "resultedAt" TIMESTAMP(3),
    "resultedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "criticalAckAt" TIMESTAMP(3),
    "criticalAckById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_code_key" ON "LabTest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_orderNumber_key" ON "LabOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_accessionNumber_key" ON "LabOrder"("accessionNumber");

-- CreateIndex
CREATE INDEX "LabOrder_status_idx" ON "LabOrder"("status");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Starter test catalogue with adult reference ranges (review with the pathologist before go-live).
INSERT INTO "LabTest" ("id", "code", "name", "department", "sampleType", "price", "parameters", "turnaroundHours", "active", "createdAt", "updatedAt") VALUES
  ('lab_cbc', 'LAB-CBC', 'Complete blood count (CBC)', 'LAB', 'Blood (EDTA)', 350,
   '[{"name":"Haemoglobin","unit":"g/dL","low":12,"high":16,"criticalLow":7,"criticalHigh":20},{"name":"Total WBC count","unit":"/µL","low":4000,"high":11000,"criticalLow":2000,"criticalHigh":30000},{"name":"Platelets","unit":"/µL","low":150000,"high":450000,"criticalLow":20000,"criticalHigh":1000000}]', 4, true, now(), now()),
  ('lab_plt', 'LAB-PLT', 'Platelet count', 'LAB', 'Blood (EDTA)', 250,
   '[{"name":"Platelets","unit":"/µL","low":150000,"high":450000,"criticalLow":20000,"criticalHigh":1000000}]', 2, true, now(), now()),
  ('lab_lft', 'LAB-LFT', 'Liver function test', 'LAB', 'Blood (serum)', 700,
   '[{"name":"Total bilirubin","unit":"mg/dL","low":0.3,"high":1.2,"criticalHigh":15},{"name":"SGPT (ALT)","unit":"U/L","low":7,"high":56},{"name":"SGOT (AST)","unit":"U/L","low":10,"high":40},{"name":"Alkaline phosphatase","unit":"U/L","low":44,"high":147}]', 6, true, now(), now()),
  ('lab_kft', 'LAB-KFT', 'Kidney function test', 'LAB', 'Blood (serum)', 650,
   '[{"name":"Urea","unit":"mg/dL","low":15,"high":40},{"name":"Creatinine","unit":"mg/dL","low":0.6,"high":1.3,"criticalHigh":7},{"name":"Sodium","unit":"mmol/L","low":135,"high":145,"criticalLow":120,"criticalHigh":160},{"name":"Potassium","unit":"mmol/L","low":3.5,"high":5.1,"criticalLow":2.5,"criticalHigh":6.5}]', 6, true, now(), now()),
  ('lab_rbs', 'LAB-RBS', 'Blood sugar (random)', 'LAB', 'Blood (fluoride)', 100,
   '[{"name":"Glucose (random)","unit":"mg/dL","low":70,"high":140,"criticalLow":40,"criticalHigh":450}]', 1, true, now(), now()),
  ('lab_hba1c', 'LAB-HBA1C', 'HbA1c', 'LAB', 'Blood (EDTA)', 550,
   '[{"name":"HbA1c","unit":"%","low":4,"high":5.6}]', 24, true, now(), now()),
  ('lab_ns1', 'LAB-DENGUE', 'Dengue NS1 antigen', 'LAB', 'Blood (serum)', 900,
   '[{"name":"NS1 antigen","type":"choice","options":["Negative","Positive"],"abnormal":["Positive"]}]', 6, true, now(), now()),
  ('lab_urine', 'LAB-URINE-RE', 'Urine routine', 'LAB', 'Urine', 200,
   '[{"name":"Protein","type":"choice","options":["Nil","Trace","1+","2+","3+"],"abnormal":["1+","2+","3+"]},{"name":"Sugar","type":"choice","options":["Nil","Trace","1+","2+","3+"],"abnormal":["1+","2+","3+"]},{"name":"Pus cells","unit":"/hpf","low":0,"high":5}]', 4, true, now(), now()),
  ('rad_xray_chest', 'RAD-XRAY-CHEST', 'X-ray chest PA view', 'RADIOLOGY', NULL, 450, '[]', 4, true, now(), now()),
  ('rad_usg_abd', 'RAD-USG-ABD', 'Ultrasound abdomen', 'RADIOLOGY', NULL, 1500, '[]', 24, true, now(), now()),
  ('rad_ecg', 'RAD-ECG', 'ECG', 'RADIOLOGY', NULL, 300, '[]', 1, true, now(), now()),
  ('rad_ct_head', 'RAD-CT-HEAD', 'CT scan head (plain)', 'RADIOLOGY', NULL, 3500, '[]', 6, true, now(), now())
ON CONFLICT ("code") DO NOTHING;
