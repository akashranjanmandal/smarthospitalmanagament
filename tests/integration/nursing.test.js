import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient, dischargePatient, getAdmission } from "@/actions/admissions";
import { recordVitals, addClinicalNote, createHandover, acknowledgeHandover, getWardHandoverSheet } from "@/actions/nursing";
import { seedWard } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, admission;

beforeEach(async () => {
  h = await seedWard();
  await loginAs(h.receptionist);
  admission = (await admitPatient({
    patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever",
  })).data;
  await loginAs(h.nurse);
});

describe("vital signs", () => {
  it("lets a nurse chart vitals and flags abnormal readings", async () => {
    const res = await recordVitals(admission.id, { temperature: "101.4", pulse: "112", systolic: "118", diastolic: "76", spo2: "97" });
    expect(res.success).toBe(true);
    expect(res.data.flags.map((f) => f.label)).toEqual(["Fever", "Tachycardia"]);

    const saved = await prisma.vitalSign.findFirst({ where: { admissionId: admission.id } });
    expect(saved).toMatchObject({ temperature: 101.4, pulse: 112, recordedById: h.nurse.id });
  });

  it("rejects impossible readings", async () => {
    expect(await recordVitals(admission.id, { spo2: "140" })).toMatchObject({ success: false, message: "SpO₂ must be between 50 and 100 %" });
  });

  it("is closed to attendants, receptionists, and to discharged stays", async () => {
    for (const who of [h.attendant, h.receptionist]) {
      await loginAs(who);
      expect((await recordVitals(admission.id, { pulse: "80" })).success).toBe(false);
    }
    await loginAs(h.doctorUser);
    await dischargePatient(admission.id, { finalDiagnosis: "Viral fever", conditionAtDischarge: "STABLE" });
    await loginAs(h.nurse);
    expect(await recordVitals(admission.id, { pulse: "80" })).toMatchObject({ success: false, message: "This patient has been discharged" });
  });
});

describe("clinical notes", () => {
  it("files nursing notes for nurses and round notes for doctors", async () => {
    expect((await addClinicalNote(admission.id, { content: "Patient slept well. Oral intake fair." })).data.type).toBe("NURSING");
    await loginAs(h.doctorUser);
    expect((await addClinicalNote(admission.id, { content: "Platelets 1.2 lakh. Continue IV fluids." })).data.type).toBe("DOCTOR_ROUND");

    const { data } = await getAdmission(admission.id);
    expect(data.notes.map((n) => [n.type, n.author.firstName])).toEqual([["DOCTOR_ROUND", "Sneha"], ["NURSING", "Anita"]]);
  });

  it("needs some text", async () => {
    expect(await addClinicalNote(admission.id, { content: "  " })).toMatchObject({ success: false, message: "Write the note before saving" });
  });
});

describe("shift handover", () => {
  const sbar = {
    situation: "Day 2 of dengue, febrile 101°F at 6 pm",
    background: "No comorbidities, platelets falling",
    assessment: "Haemodynamically stable, oral intake poor",
    recommendation: "Repeat CBC at 6 am, watch for bleeding",
    pendingTasks: "6 am CBC sample; IV fluids bag change at 2 am",
  };

  it("records an SBAR handover that the next shift acknowledges", async () => {
    const created = await createHandover(admission.id, sbar);
    expect(created.success).toBe(true);

    expect(await acknowledgeHandover(created.data.id)).toMatchObject({ success: false, message: "The incoming staff member must acknowledge this handover" });

    await loginAs(h.nightNurse);
    expect((await acknowledgeHandover(created.data.id)).success).toBe(true);
    const saved = await prisma.handover.findUnique({ where: { id: created.data.id } });
    expect(saved).toMatchObject({ fromUserId: h.nurse.id, acknowledgedById: h.nightNurse.id });
    expect(saved.acknowledgedAt).toBeInstanceOf(Date);
    expect(await acknowledgeHandover(created.data.id)).toMatchObject({ success: false, message: "This handover was already acknowledged" });
  });

  it("requires situation, assessment and recommendation", async () => {
    expect(await createHandover(admission.id, { ...sbar, situation: "" })).toMatchObject({ success: false, message: "Situation, assessment and recommendation are required" });
  });

  it("gives the incoming shift one sheet with every in-patient in the ward", async () => {
    await recordVitals(admission.id, { temperature: "101.4", pulse: "88" });
    await addClinicalNote(admission.id, { content: "Complains of body ache" });
    await createHandover(admission.id, sbar);
    await loginAs(h.receptionist);
    await admitPatient({ patientId: h.p2.patient.id, bedId: h.beds[1].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Chest pain" });

    await loginAs(h.nightNurse);
    const { success, data } = await getWardHandoverSheet({ wardId: h.ward.id });
    expect(success).toBe(true);
    expect(data.patients).toHaveLength(2);
    const first = data.patients[0];
    expect(first).toMatchObject({
      bedNumber: "GW-01",
      patient: { firstName: "Sanjay", uhid: expect.stringMatching(/^SHDS-/) },
      doctor: "Dr. Sneha Iyer",
      latestVitals: { temperature: 101.4, flags: [{ label: "Fever" }] },
      latestNote: { content: "Complains of body ache" },
      latestHandover: { pendingTasks: sbar.pendingTasks, acknowledged: false },
    });
    expect(data.patients[1]).toMatchObject({ bedNumber: "GW-02", latestVitals: null, latestHandover: null });
  });

  it("keeps the handover sheet away from front office and attendants", async () => {
    for (const who of [h.receptionist, h.attendant]) {
      await loginAs(who);
      expect((await getWardHandoverSheet({})).success).toBe(false);
    }
  });
});
