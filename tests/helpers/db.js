import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const TABLES = [
  "MealOrder", "MenuItem",
  "LabOrder", "LabTest",
  "MedicationAdministration", "MedicationOrder", "PharmacyOrderItem", "PharmacyOrder", "StockBatch", "Medicine",
  "InsuranceClaim", "PreAuth", "AdmissionPayment", "AdmissionCharge", "ServiceTariff",
  "AuditLog", "Handover", "ClinicalNote", "VitalSign", "Admission", "Sequence",
  "ComplaintEscalationLog", "Complaint", "BedStatusLog", "Bed", "Ward", "PrescriptionItem", "Prescription",
  "Bill", "MedicalRecord", "Appointment", "RegistrationCode", "OtpCode", "PasswordResetToken", "Doctor",
  "Patient", "User", "Department",
];

export async function resetDb() {
  const url = process.env.DATABASE_URL || "";
  if (!url.includes("_test")) throw new Error(`Refusing to wipe non-test database: ${url}`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

export const PASSWORD = "Test@1234";
let seq = 0;

export async function createUser({ role = "PATIENT", email, password = PASSWORD, ...rest } = {}) {
  seq += 1;
  return prisma.user.create({
    data: {
      email: email || `${role.toLowerCase()}${seq}@test.local`,
      password: password ? await bcrypt.hash(password, 4) : null,
      firstName: rest.firstName || role,
      lastName: rest.lastName || String(seq),
      role,
      profileComplete: true,
      ...rest,
    },
  });
}

export async function createDepartment(name = `Dept ${++seq}`) {
  return prisma.department.create({ data: { name } });
}

export async function createDoctor({ departmentId, ...userData } = {}) {
  const dept = departmentId ? { id: departmentId } : await createDepartment();
  const user = await createUser({ role: "DOCTOR", ...userData });
  const doctor = await prisma.doctor.create({ data: { userId: user.id, departmentId: dept.id, specialization: "General" } });
  return { user, doctor };
}

export async function createPatient(userData = {}) {
  const user = await createUser({ role: "PATIENT", ...userData });
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: "MALE",
      dateOfBirth: new Date("1990-01-01"),
      phone: `98765${String(++seq).padStart(5, "0")}`,
    },
  });
  return { user, patient };
}

export async function createAppointment({ doctorId, patientId, status = "COMPLETED" }) {
  return prisma.appointment.create({
    data: { doctorId, patientId, appointmentDate: new Date(Date.now() + 86400000), appointmentTime: "10:00", status },
  });
}

/** A ward with vacant beds, plus the people an in-patient stay involves. */
export async function seedWard() {
  const dept = await createDepartment("General Medicine");
  const other = await createDepartment("Cardiology");
  const { user: doctorUser, doctor } = await createDoctor({ departmentId: dept.id, firstName: "Sneha", lastName: "Iyer" });
  const { doctor: cardiologist } = await createDoctor({ departmentId: other.id });
  const admin = await createUser({ role: "ADMIN" });
  const receptionist = await createUser({ role: "RECEPTIONIST" });
  const nurse = await createUser({ role: "NURSE", firstName: "Anita", lastName: "Das" });
  const nightNurse = await createUser({ role: "NURSE", firstName: "Rekha", lastName: "Paul" });
  const attendant = await createUser({ role: "WARD_ATTENDANT" });
  const ward = await prisma.ward.create({ data: { name: "General Ward", floor: 1, departmentId: dept.id } });
  const beds = [];
  for (const n of ["GW-01", "GW-02", "GW-03"]) beds.push(await prisma.bed.create({ data: { wardId: ward.id, bedNumber: n } }));
  const p1 = await createPatient({ firstName: "Sanjay", lastName: "Verma" });
  const p2 = await createPatient();
  return { dept, other, doctorUser, doctor, cardiologist, admin, receptionist, nurse, nightNurse, attendant, ward, beds, p1, p2 };
}

/** A minimal hospital: one department, a doctor, two patients each with a completed visit, record, prescription and bill. */
export async function seedHospital() {
  const dept = await createDepartment("Cardiology");
  const { user: doctorUser, doctor } = await createDoctor({ departmentId: dept.id });
  const admin = await createUser({ role: "ADMIN" });
  const receptionist = await createUser({ role: "RECEPTIONIST" });
  const p1 = await createPatient();
  const p2 = await createPatient();
  const visits = [];
  for (const p of [p1, p2]) {
    const appointment = await createAppointment({ doctorId: doctor.id, patientId: p.patient.id });
    const record = await prisma.medicalRecord.create({
      data: { patientId: p.patient.id, doctorId: doctor.id, appointmentId: appointment.id, diagnosis: "Dx" },
    });
    const prescription = await prisma.prescription.create({
      data: { medicalRecordId: record.id, doctorId: doctor.id, items: { create: [{ medicineName: "Med", dosage: "1", frequency: "1", duration: "1" }] } },
    });
    const bill = await prisma.bill.create({
      data: { patientId: p.patient.id, appointmentId: appointment.id, consultationFee: 500, totalAmount: 500 },
    });
    visits.push({ ...p, appointment, record, prescription, bill });
  }
  return { dept, doctorUser, doctor, admin, receptionist, p1: visits[0], p2: visits[1] };
}

/** Returns every user email whose password hash appears anywhere in a value. */
export function findPasswordHashes(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => findPasswordHashes(v, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "password" && v) found.add(value.email || value.id);
      else findPasswordHashes(v, found);
    }
  }
  return [...found];
}
