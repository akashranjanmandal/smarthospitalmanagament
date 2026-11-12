// One-off/reusable demo data seed: a branch, departments, a ward with beds, and one account per
// role (same accounts documented in README's demo table), plus one admitted sample patient.
// Safe to re-run: every create is guarded by an existence check first.
//
// Run with:  node prisma/seed-demo.js
// Uses whatever DATABASE_URL / DIRECT_URL is in .env — point that at the database you mean to seed.
// (Plain Node script, so it builds its own Prisma client with relative imports instead of the
// "@/" alias Next.js provides — lib/prisma.js's own client isn't reachable from here.)
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaClient } from "../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { platformExtension, nextSequence } from "../lib/audit/extension.js";
import { formatAdmissionNumber } from "../lib/identifiers.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = new PrismaClient({ adapter: new PrismaPg(pool) });
const prisma = base.$extends(platformExtension(base));

const PASSWORD = "Test@1234";

async function upsertUser({ email, role, firstName, lastName, branchId = null, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, password: password || (await bcrypt.hash(PASSWORD, 10)), role, firstName, lastName, profileComplete: true, branchId },
  });
}

async function main() {
  console.log("Seeding demo data...");

  // 1. Branch
  let branch = await prisma.branch.findUnique({ where: { name: "Main Branch" } });
  if (!branch) branch = await prisma.branch.create({ data: { name: "Main Branch", code: "MAIN", city: "Bengaluru" } });
  console.log("Branch:", branch.name);

  // 2. Super admin (chain-wide, no branch)
  await upsertUser({ email: "admin@shds.com", role: "SUPER_ADMIN", firstName: "Super", lastName: "Admin", password: await bcrypt.hash("Admin@123", 10) });

  // 3. Departments
  const deptSpecs = [
    ["Cardiology", "Dr. Rahul", "Mehta", "Cardiology", "doctor@test.com"],
    ["General Medicine", "Dr. Sneha", "Iyer", "General Medicine", "doctor2@test.com"],
  ];
  const depts = {};
  for (const [name] of deptSpecs) {
    let d = await prisma.department.findFirst({ where: { branchId: branch.id, name } });
    if (!d) d = await prisma.department.create({ data: { name, branchId: branch.id } });
    depts[name] = d;
  }

  // 4. Doctors
  const doctors = {};
  for (const [name, first, last, spec, email] of deptSpecs) {
    const user = await upsertUser({ email, role: "DOCTOR", firstName: first, lastName: last, branchId: branch.id });
    let doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) doctor = await prisma.doctor.create({ data: { userId: user.id, departmentId: depts[name].id, specialization: spec } });
    doctors[name] = doctor;
  }

  // 5. Other staff (every role, matching README's demo accounts table)
  await upsertUser({ email: "admin@test.com", role: "ADMIN", firstName: "Admin", lastName: "User", branchId: branch.id });
  await upsertUser({ email: "reception@test.com", role: "RECEPTIONIST", firstName: "Reception", lastName: "Desk", branchId: branch.id });
  await upsertUser({ email: "nurse@test.com", role: "NURSE", firstName: "Anita", lastName: "Das", branchId: branch.id });
  await upsertUser({ email: "nurse2@test.com", role: "NURSE", firstName: "Rekha", lastName: "Paul", branchId: branch.id });
  await upsertUser({ email: "ward@test.com", role: "WARD_ATTENDANT", firstName: "Ramesh", lastName: "Yadav", branchId: branch.id });
  await upsertUser({ email: "tpa@test.com", role: "INSURANCE_DESK", firstName: "Farah", lastName: "Khan", branchId: branch.id });
  await upsertUser({ email: "pharmacy@test.com", role: "PHARMACIST", firstName: "Ravi", lastName: "Menon", branchId: branch.id });
  await upsertUser({ email: "lab@test.com", role: "LAB_TECH", firstName: "Lata", lastName: "Shah", branchId: branch.id });
  await upsertUser({ email: "lab2@test.com", role: "LAB_TECH", firstName: "Imran", lastName: "Ali", branchId: branch.id });
  await upsertUser({ email: "kitchen@test.com", role: "KITCHEN", firstName: "Meena", lastName: "Iyer", branchId: branch.id });
  await upsertUser({ email: "kiosk@test.com", role: "KIOSK", firstName: "Lobby", lastName: "Kiosk", branchId: branch.id });

  // 6. Ward and beds
  let ccu = await prisma.ward.findFirst({ where: { branchId: branch.id, name: "CCU" } });
  if (!ccu) ccu = await prisma.ward.create({ data: { name: "CCU", floor: 2, departmentId: depts.Cardiology.id, branchId: branch.id, genderWard: "MIXED" } });
  let generalWard = await prisma.ward.findFirst({ where: { branchId: branch.id, name: "General Ward" } });
  if (!generalWard) generalWard = await prisma.ward.create({ data: { name: "General Ward", floor: 1, departmentId: depts["General Medicine"].id, branchId: branch.id, genderWard: "MIXED" } });

  const bedSpecs = [
    [ccu.id, "CCU-01", "ICU"],
    [generalWard.id, "GW-01", "GENERAL"],
    [generalWard.id, "GW-02", "GENERAL"],
    [generalWard.id, "GW-03", "GENERAL"],
  ];
  const beds = {};
  for (const [wardId, bedNumber, bedType] of bedSpecs) {
    let bed = await prisma.bed.findFirst({ where: { wardId, bedNumber } });
    if (!bed) bed = await prisma.bed.create({ data: { wardId, bedNumber, bedType } });
    beds[bedNumber] = bed;
  }

  // 7. A demo patient
  let patientUser = await prisma.user.findUnique({ where: { email: "patient@test.com" } });
  let patient;
  if (!patientUser) {
    patientUser = await upsertUser({ email: "patient@test.com", role: "PATIENT", firstName: "Amit", lastName: "Kumar" });
    patient = await prisma.patient.create({
      data: {
        userId: patientUser.id, firstName: "Amit", lastName: "Kumar", gender: "MALE",
        dateOfBirth: new Date("1985-06-12"), phone: "9876500099", bloodGroup: "B+",
        allergies: "Penicillin", address: "Bengaluru",
      },
    });
  } else {
    patient = await prisma.patient.findUnique({ where: { userId: patientUser.id } });
  }

  // 8. Admit the demo patient into CCU-01, if not already admitted anywhere
  const freshBed = await prisma.bed.findUnique({ where: { id: beds["CCU-01"].id } });
  const existingStay = await prisma.admission.findFirst({ where: { patientId: patient.id, status: "ADMITTED" } });
  if (!existingStay && freshBed.status === "VACANT") {
    const year = new Date().getFullYear();
    const admissionNumber = formatAdmissionNumber(year, await nextSequence(prisma, `admission-${year}`));
    await prisma.$transaction(async (tx) => {
      await tx.bed.update({
        where: { id: beds["CCU-01"].id },
        data: { status: "OCCUPIED", patientId: patient.id, departmentId: depts.Cardiology.id, doctorId: doctors.Cardiology.id },
      });
      await tx.bedStatusLog.create({
        data: { bedId: beds["CCU-01"].id, previousStatus: "VACANT", newStatus: "OCCUPIED", notes: `Admitted ${admissionNumber} (seed)` },
      });
      await tx.admission.create({
        data: {
          admissionNumber, patientId: patient.id, bedId: beds["CCU-01"].id,
          departmentId: depts.Cardiology.id, doctorId: doctors.Cardiology.id,
          reason: "Chest pain, under observation", provisionalDiagnosis: "Unstable angina",
          dietType: "DIABETIC", dietNotes: "1800 kcal", branchId: branch.id,
        },
      });
    });
    console.log("Admitted demo patient Amit Kumar into CCU-01 as", admissionNumber);
  } else {
    console.log("Demo patient already admitted or CCU-01 occupied — skipped admission step.");
  }

  console.log("\nDone. Every staff password is Test@1234 (super admin: Admin@123).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
