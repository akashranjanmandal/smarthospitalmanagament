import { describe, it, expect } from "vitest";
import { getAllPatients, getPatients, getPatientById } from "@/actions/patients";
import { getAllDoctors, getDoctors, getDoctorById } from "@/actions/doctors";
import { getAppointments, getAppointmentById } from "@/actions/appointments";
import { getMedicalRecords, getMedicalRecordById } from "@/actions/medical-records";
import { getPrescriptions, getPrescriptionById } from "@/actions/prescriptions";
import { getBills, getBillById } from "@/actions/billing";
import { getFeedbackDashboardData, submitPublicFeedback } from "@/actions/feedback";
import { getRegistrationCodes, generateRegistrationCode } from "@/actions/registration-codes";
import { ensureUser, getCurrentUser } from "@/lib/auth";
import { seedHospital, findPasswordHashes } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

describe("password hashes never leave the server", () => {
  const listActions = {
    getAllPatients: () => getAllPatients(),
    getPatients: () => getPatients({}),
    getAllDoctors: () => getAllDoctors(),
    getDoctors: () => getDoctors({}),
    getAppointments: () => getAppointments({}),
    getMedicalRecords: () => getMedicalRecords({}),
    getPrescriptions: () => getPrescriptions({}),
    getBills: () => getBills({}),
    getFeedbackDashboardData: () => getFeedbackDashboardData({}),
    getRegistrationCodes: () => getRegistrationCodes({}),
  };

  it.each(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT"])("in list results seen by %s", async (role) => {
    const h = await seedHospital();
    const who = { ADMIN: h.admin, RECEPTIONIST: h.receptionist, DOCTOR: h.doctorUser, PATIENT: h.p1.user }[role];
    await loginAs(who || { ...h.admin, role: "SUPER_ADMIN" });
    if (role === "SUPER_ADMIN") {
      const { prisma } = await import("@/lib/prisma");
      await prisma.user.update({ where: { id: h.admin.id }, data: { role: "SUPER_ADMIN" } });
      await generateRegistrationCode({ role: "RECEPTIONIST" });
    }
    for (const [name, call] of Object.entries(listActions)) {
      const result = await call();
      expect(findPasswordHashes(result), `${name} as ${role}`).toEqual([]);
    }
  });

  it("in detail results", async () => {
    const h = await seedHospital();
    await loginAs(h.admin);
    for (const result of [
      await getPatientById(h.p1.patient.id),
      await getDoctorById(h.doctor.id),
      await getAppointmentById(h.p1.appointment.id),
      await getMedicalRecordById(h.p1.record.id),
      await getPrescriptionById(h.p1.prescription.id),
      await getBillById(h.p1.bill.id),
    ]) {
      expect(result.success).toBe(true);
      expect(findPasswordHashes(result)).toEqual([]);
    }
  });

  it("in the current-user object passed to every page", async () => {
    const h = await seedHospital();
    await loginAs(h.p1.user);
    expect(findPasswordHashes(await ensureUser())).toEqual([]);
    expect(findPasswordHashes(await getCurrentUser())).toEqual([]);
  });
});

describe("patients only see their own data", () => {
  it("getAllPatients returns only the patient themself", async () => {
    const h = await seedHospital();
    await loginAs(h.p1.user);
    const r = await getAllPatients();
    expect(r.success).toBe(true);
    expect(r.data.map((p) => p.id)).toEqual([h.p1.patient.id]);
  });

  it("staff still get every patient from getAllPatients", async () => {
    const h = await seedHospital();
    for (const staff of [h.receptionist, h.admin, h.doctorUser]) {
      await loginAs(staff);
      expect((await getAllPatients()).data).toHaveLength(2);
    }
  });

  it("cannot open another patient's records by id", async () => {
    const h = await seedHospital();
    await loginAs(h.p1.user);
    expect((await getPatientById(h.p2.patient.id)).success).toBe(false);
    expect((await getAppointmentById(h.p2.appointment.id)).success).toBe(false);
    expect((await getMedicalRecordById(h.p2.record.id)).success).toBe(false);
    expect((await getPrescriptionById(h.p2.prescription.id)).success).toBe(false);
    expect((await getBillById(h.p2.bill.id)).success).toBe(false);
    // ...but can open their own
    expect((await getMedicalRecordById(h.p1.record.id)).success).toBe(true);
    expect((await getBillById(h.p1.bill.id)).success).toBe(true);
  });

  it("lists contain only the patient's own items", async () => {
    const h = await seedHospital();
    await loginAs(h.p1.user);
    for (const r of [await getAppointments({}), await getMedicalRecords({}), await getBills({}), await getPatients({})]) {
      expect(r.data).toHaveLength(1);
    }
    expect((await getPrescriptions({})).data).toHaveLength(1);
  });

  it("cannot read the staff grievance dashboard (other people's complaints)", async () => {
    const h = await seedHospital();
    await submitPublicFeedback({ category: "WAIT_TIME", title: "Late", description: "Waited long", departmentId: h.dept.id, patientName: "Someone Else", patientPhone: "9999999999" });
    await loginAs(h.p1.user);
    const r = await getFeedbackDashboardData({});
    expect(r.success).toBe(false);
  });

  it("staff can read the grievance dashboard", async () => {
    const h = await seedHospital();
    await submitPublicFeedback({ category: "WAIT_TIME", title: "Late", description: "Waited long", departmentId: h.dept.id });
    for (const staff of [h.admin, h.receptionist, h.doctorUser]) {
      await loginAs(staff);
      const r = await getFeedbackDashboardData({});
      expect(r.success).toBe(true);
      expect(r.data.complaints).toHaveLength(1);
    }
  });
});
