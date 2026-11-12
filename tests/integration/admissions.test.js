import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient, dischargePatient, getAdmissions, getAdmission, getAdmitFormOptions } from "@/actions/admissions";
import { updateBedStatus, getBedDashboardData } from "@/actions/beds";
import { seedWard } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h;
const admitData = (over = {}) => ({
  patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id,
  reason: "High fever for 4 days", provisionalDiagnosis: "Dengue fever", ...over,
});
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

beforeEach(async () => {
  h = await seedWard();
  await loginAs(h.receptionist);
});

describe("admitting a patient", () => {
  it("creates a numbered admission and occupies the bed with patient, department and doctor", async () => {
    const res = await admitPatient(admitData());
    expect(res.success).toBe(true);
    expect(res.data.admissionNumber).toMatch(/^IP-\d{4}-000001$/);

    const bed = await prisma.bed.findUnique({ where: { id: h.beds[0].id } });
    expect(bed).toMatchObject({ status: "OCCUPIED", patientId: h.p1.patient.id, departmentId: h.dept.id, doctorId: h.doctor.id });
    expect(await prisma.bedStatusLog.count({ where: { bedId: bed.id, newStatus: "OCCUPIED" } })).toBe(1);

    const second = await admitPatient(admitData({ patientId: h.p2.patient.id, bedId: h.beds[1].id }));
    expect(second.data.admissionNumber).toMatch(/-000002$/);
  });

  it("requires a reason, department and a doctor from that department", async () => {
    expect(await admitPatient(admitData({ reason: " " }))).toMatchObject({ success: false, message: "Enter the reason for admission" });
    expect(await admitPatient(admitData({ departmentId: "" }))).toMatchObject({ success: false, message: "Select the admitting department" });
    expect(await admitPatient(admitData({ doctorId: "" }))).toMatchObject({ success: false, message: "Select the attending doctor" });
    expect(await admitPatient(admitData({ doctorId: h.cardiologist.id }))).toMatchObject({ success: false, message: "The selected doctor is not in the selected department" });
    expect(await prisma.admission.count()).toBe(0);
  });

  it("only uses a vacant or reserved bed", async () => {
    await prisma.bed.update({ where: { id: h.beds[0].id }, data: { status: "NEEDS_CLEANING" } });
    expect(await admitPatient(admitData())).toMatchObject({ success: false, message: "Bed GW-01 is not available (Needs Cleaning)" });
    await prisma.bed.update({ where: { id: h.beds[0].id }, data: { status: "RESERVED" } });
    expect((await admitPatient(admitData())).success).toBe(true);
  });

  it("does not admit the same patient twice", async () => {
    await admitPatient(admitData());
    const again = await admitPatient(admitData({ bedId: h.beds[1].id }));
    expect(again.success).toBe(false);
    expect(again.message).toMatch(/already admitted in bed GW-01/);
  });

  it("is done by front office, admins and doctors, not nurses, attendants or patients", async () => {
    for (const who of [h.nurse, h.attendant, h.p1.user]) {
      await loginAs(who);
      expect((await admitPatient(admitData())).success).toBe(false);
    }
    await loginAs(h.doctorUser);
    expect((await admitPatient(admitData())).success).toBe(true);
  });

  it("shows the patient, department, doctor and admission on the bed board", async () => {
    await admitPatient(admitData());
    const { data } = await getBedDashboardData();
    const shown = data.wards[0].beds.find((b) => b.bedNumber === "GW-01");
    expect(shown.department).toEqual({ id: h.dept.id, name: "General Medicine" });
    expect(shown.doctor).toMatchObject({ user: { firstName: "Sneha", lastName: "Iyer" } });
    expect(shown.admission).toMatchObject({ admissionNumber: expect.stringMatching(/^IP-/) });
  });

  it("offers vacant and reserved beds, patients not already admitted, departments and doctors — to admitting staff only", async () => {
    await admitPatient(admitData());
    const { data } = await getAdmitFormOptions();
    expect(data.beds.map((b) => b.bedNumber)).toEqual(["GW-02", "GW-03"]);
    expect(data.patients.map((p) => p.id)).not.toContain(h.p1.patient.id);
    expect(data.patients[0]).toHaveProperty("uhid");
    expect(data.departments.map((d) => d.name)).toEqual(["Cardiology", "General Medicine"]);
    expect(data.doctors.map((d) => d.id)).toContain(h.doctor.id);
    for (const who of [h.attendant, h.nurse]) {
      await loginAs(who);
      expect((await getAdmitFormOptions()).success).toBe(false);
    }
  });
});

describe("bed board rules once admissions exist", () => {
  it("cannot occupy a bed except through admission", async () => {
    const res = await updateBedStatus(h.beds[0].id, { status: "OCCUPIED", patientId: h.p1.patient.id });
    expect(res).toMatchObject({ success: false, message: "Use Admit Patient to occupy a bed" });
  });

  it("cannot free a bed while its patient is still admitted", async () => {
    await admitPatient(admitData());
    await loginAs(h.attendant);
    expect(await updateBedStatus(h.beds[0].id, { status: "VACANT" })).toMatchObject({ success: false, message: "Discharge the patient before releasing this bed" });
  });

  it("lets ward attendants mark a cleaned bed vacant", async () => {
    await prisma.bed.update({ where: { id: h.beds[0].id }, data: { status: "NEEDS_CLEANING" } });
    await loginAs(h.attendant);
    expect((await updateBedStatus(h.beds[0].id, { status: "VACANT" })).success).toBe(true);
  });
});

describe("discharging a patient", () => {
  let admission;
  const summary = (over = {}) => ({
    finalDiagnosis: "Dengue fever without warning signs",
    treatmentGiven: "IV fluids, paracetamol, platelet monitoring",
    conditionAtDischarge: "STABLE",
    dischargeMedications: [{ name: "Paracetamol 650 mg", dose: "1 tablet", frequency: "Three times a day", duration: "3 days" }],
    dischargeAdvice: "Drink 3 litres of fluid a day. Rest for one week.",
    warningSigns: "Bleeding gums, black stools, severe stomach pain",
    ...over,
  });

  beforeEach(async () => {
    admission = (await admitPatient(admitData())).data;
    await loginAs(h.doctorUser);
  });

  it("records the summary, frees the bed for cleaning and books the follow-up visit", async () => {
    const res = await dischargePatient(admission.id, summary({ followUpDate: tomorrow, followUpTime: "11:30" }));
    expect(res.success).toBe(true);

    const done = await prisma.admission.findUnique({ where: { id: admission.id } });
    expect(done).toMatchObject({ status: "DISCHARGED", finalDiagnosis: "Dengue fever without warning signs", conditionAtDischarge: "STABLE" });
    expect(done.dischargedAt).toBeInstanceOf(Date);
    expect(done.dischargeMedications).toHaveLength(1);

    const bed = await prisma.bed.findUnique({ where: { id: h.beds[0].id } });
    expect(bed).toMatchObject({ status: "NEEDS_CLEANING", patientId: null, departmentId: null, doctorId: null });

    const followUp = await prisma.appointment.findFirst({ where: { patientId: h.p1.patient.id } });
    expect(followUp).toMatchObject({ doctorId: h.doctor.id, appointmentTime: "11:30", status: "SCHEDULED" });
    expect(followUp.reason).toMatch(/Follow-up after discharge \(IP-/);
  });

  it("requires a final diagnosis and the condition at discharge", async () => {
    expect(await dischargePatient(admission.id, summary({ finalDiagnosis: "" }))).toMatchObject({ success: false, message: "Enter the final diagnosis" });
    expect(await dischargePatient(admission.id, summary({ conditionAtDischarge: "" }))).toMatchObject({ success: false, message: "Select the condition at discharge" });
  });

  it("cannot discharge twice, and nurses cannot discharge", async () => {
    await loginAs(h.nurse);
    expect((await dischargePatient(admission.id, summary())).success).toBe(false);
    await loginAs(h.doctorUser);
    expect((await dischargePatient(admission.id, summary())).success).toBe(true);
    expect(await dischargePatient(admission.id, summary())).toMatchObject({ success: false, message: "This patient has already been discharged" });
  });
});

describe("viewing admissions", () => {
  it("lists active in-patients for staff and searches by name, UHID or admission number", async () => {
    await admitPatient(admitData());
    await admitPatient(admitData({ patientId: h.p2.patient.id, bedId: h.beds[1].id }));
    await loginAs(h.nurse);
    expect((await getAdmissions({ status: "ADMITTED" })).data).toHaveLength(2);
    expect((await getAdmissions({ search: "sanjay" })).data).toHaveLength(1);
    const { uhid } = await prisma.patient.findUnique({ where: { id: h.p1.patient.id } });
    expect((await getAdmissions({ search: uhid })).data.map((a) => a.patient.uhid)).toEqual([uhid]);
    expect((await getAdmissions({ search: "IP-" })).data).toHaveLength(2);
  });

  it("shows patients only their own admissions", async () => {
    const mine = (await admitPatient(admitData())).data;
    const theirs = (await admitPatient(admitData({ patientId: h.p2.patient.id, bedId: h.beds[1].id }))).data;
    await loginAs(h.p1.user);
    expect((await getAdmissions({})).data.map((a) => a.id)).toEqual([mine.id]);
    expect((await getAdmission(mine.id)).success).toBe(true);
    expect(await getAdmission(theirs.id)).toMatchObject({ success: false, message: "Admission not found" });
  });

  it("returns the full stay for the detail page", async () => {
    const { id } = (await admitPatient(admitData())).data;
    const { data } = await getAdmission(id);
    expect(data).toMatchObject({
      reason: "High fever for 4 days",
      patient: { firstName: "Sanjay", uhid: expect.stringMatching(/^SHDS-/) },
      bed: { bedNumber: "GW-01", ward: { name: "General Ward" } },
      department: { name: "General Medicine" },
      doctor: { user: { firstName: "Sneha" } },
      vitals: [], notes: [], handovers: [],
    });
  });
});
