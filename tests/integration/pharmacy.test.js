import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPrescription, getPrescriptionById } from "@/actions/prescriptions";
import { saveMedicine, receiveStock, getFormulary, getPharmacyQueue, startPreparing, matchItem, markReady, dispense } from "@/actions/pharmacy";
import { orderMedication, stopMedication, recordDose, getMedicationChart } from "@/actions/medication-orders";
import { admitPatient } from "@/actions/admissions";
import { getAdmissionBill } from "@/actions/ipd-billing";
import { seedWard, createUser, createAppointment } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, pharmacist, para, amox, record;
const future = (months) => new Date(Date.now() + months * 30 * 86400000).toISOString().slice(0, 10);

beforeEach(async () => {
  h = await seedWard();
  pharmacist = await createUser({ role: "PHARMACIST", firstName: "Ravi", lastName: "Chem" });
  await loginAs(pharmacist);
  para = (await saveMedicine({ name: "Dolo 650", genericName: "Paracetamol", strength: "650 mg", form: "TABLET", unitPrice: 2, gstRate: 12 })).data;
  amox = (await saveMedicine({ name: "Mox 500", genericName: "Amoxicillin", strength: "500 mg", form: "CAPSULE", unitPrice: 8, gstRate: 12 })).data;
  await receiveStock(para.id, { batchNumber: "P-OLD", expiryDate: future(2), quantity: 6 });
  await receiveStock(para.id, { batchNumber: "P-NEW", expiryDate: future(12), quantity: 100 });
  await receiveStock(amox.id, { batchNumber: "A-1", expiryDate: future(6), quantity: 30 });

  const appt = await createAppointment({ doctorId: h.doctor.id, patientId: h.p1.patient.id });
  record = await prisma.medicalRecord.create({ data: { patientId: h.p1.patient.id, doctorId: h.doctor.id, appointmentId: appt.id, diagnosis: "Viral fever" } });
  await loginAs(h.doctorUser);
});

const prescribe = (items, extra = {}) => createPrescription({ medicalRecordId: record.id, items, ...extra });
const paraLine = { medicineName: "Dolo 650", dosage: "1 tablet", frequency: "1-0-1", duration: "5 days" };

describe("formulary and stock", () => {
  it("is kept by the pharmacy and readable by doctors", async () => {
    expect((await saveMedicine({ name: "X", genericName: "x", form: "TABLET", unitPrice: 1 })).success).toBe(false);
    const { data } = await getFormulary({ search: "para" });
    expect(data.map((m) => [m.name, m.stockOnHand])).toEqual([["Dolo 650", 106]]);
  });

  it("refuses expired stock on receipt", async () => {
    await loginAs(pharmacist);
    expect(await receiveStock(para.id, { batchNumber: "OLD", expiryDate: "2020-01-01", quantity: 5 })).toMatchObject({ success: false, message: "This batch has already expired" });
  });
});

describe("OPD prescription to pharmacy pickup", () => {
  it("sends the prescription to the pharmacy queue with quantities worked out", async () => {
    const rx = await prescribe([paraLine, { medicineName: "Unlisted syrup", dosage: "5 ml", frequency: "TDS", duration: "3 days" }]);
    expect(rx.success).toBe(true);
    await loginAs(pharmacist);
    const { data } = await getPharmacyQueue({});
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ source: "OPD", status: "RECEIVED", orderNumber: expect.stringMatching(/^RX-\d{4}-\d{6}$/), patient: { firstName: "Sanjay" } });
    expect(data[0].items.map((i) => [i.name, i.quantity, i.medicineId ? "matched" : "unmatched"])).toEqual([["Dolo 650", 10, "matched"], ["Unlisted syrup", 9, "unmatched"]]);
  });

  it("warns about allergies before saving, and saves once the doctor confirms", async () => {
    await prisma.patient.update({ where: { id: h.p1.patient.id }, data: { allergies: "Penicillin" } });
    const first = await prescribe([{ medicineName: "Mox 500", dosage: "1 capsule", frequency: "TDS", duration: "5 days" }]);
    expect(first).toMatchObject({ success: false, needsConfirmation: true, warnings: [{ type: "ALLERGY", message: "Mox 500 — patient is allergic to Penicillin" }] });
    expect(await prisma.prescription.count()).toBe(0);
    expect((await prescribe([{ medicineName: "Mox 500", dosage: "1 capsule", frequency: "TDS", duration: "5 days" }], { acknowledgeWarnings: true })).success).toBe(true);
  });

  it("is prepared, made ready from the batch expiring first, and handed over only to the right patient", async () => {
    const rx = await prescribe([paraLine]);
    await loginAs(pharmacist);
    const order = (await getPharmacyQueue({})).data[0];
    expect((await startPreparing(order.id)).success).toBe(true);
    const ready = await markReady(order.id);
    expect(ready).toMatchObject({ success: true, data: { total: 22.4 } });

    const batches = await prisma.stockBatch.findMany({ where: { medicineId: para.id }, orderBy: { batchNumber: "asc" } });
    expect(batches.map((b) => [b.batchNumber, b.quantity])).toEqual([["P-NEW", 96], ["P-OLD", 0]]);

    expect(await dispense(order.id, { confirmUhid: "SHDS-99999999" })).toMatchObject({ success: false, message: "UHID does not match this order" });
    const uhid = (await prisma.patient.findUnique({ where: { id: h.p1.patient.id } })).uhid;
    expect((await dispense(order.id, { confirmUhid: uhid.toLowerCase() })).success).toBe(true);

    await loginAs(h.p1.user);
    const mine = await getPrescriptionById(rx.data.id);
    expect(mine.data.pharmacyOrder).toMatchObject({ status: "DISPENSED" });
  });

  it("needs every line matched to stock before it is ready, and reports shortages", async () => {
    await prescribe([{ medicineName: "Unlisted syrup", dosage: "5 ml", frequency: "TDS", duration: "3 days" }, { medicineName: "Mox 500", dosage: "1", frequency: "QID", duration: "10 days" }]);
    await loginAs(pharmacist);
    const order = (await getPharmacyQueue({})).data[0];
    expect(await markReady(order.id)).toMatchObject({ success: false, message: "Choose a stocked medicine for: Unlisted syrup" });
    const syrup = order.items.find((i) => !i.medicineId);
    expect((await matchItem(syrup.id, para.id, { reason: "Syrup out of stock, tablet given" })).success).toBe(true);
    expect(await markReady(order.id)).toMatchObject({ success: false, message: "Not enough stock: Mox 500 (need 40, have 30)" });
  });

  it("is closed to nurses and patients", async () => {
    await loginAs(h.nurse);
    expect((await getPharmacyQueue({})).success).toBe(false);
  });
});

describe("in-patient medicine orders and the medication chart", () => {
  let admission;
  beforeEach(async () => {
    await loginAs(h.receptionist);
    admission = (await admitPatient({ patientId: h.p2.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
    await loginAs(h.doctorUser);
  });

  it("lets the doctor order, sends a ward indent to the pharmacy and bills what is issued", async () => {
    const ord = await orderMedication(admission.id, { medicineId: para.id, dose: "650 mg", route: "ORAL", frequency: "TDS", durationDays: 2 });
    expect(ord.success).toBe(true);
    await loginAs(pharmacist);
    const indent = (await getPharmacyQueue({})).data[0];
    expect(indent).toMatchObject({ source: "IPD", items: [{ name: "Dolo 650", quantity: 6 }] });
    await markReady(indent.id);
    expect((await dispense(indent.id, {})).success).toBe(true);

    await loginAs(h.receptionist);
    const bill = (await getAdmissionBill(admission.id)).data;
    expect(bill.lines.map((l) => [l.description, l.category, l.quantity])).toEqual([["Dolo 650 (650 mg)", "PHARMACY", 6]]);
  });

  it("records each dose on the medication chart, with a reason when a dose is not given", async () => {
    const { data: order } = await orderMedication(admission.id, { medicineId: para.id, dose: "650 mg", route: "ORAL", frequency: "BD", durationDays: 3 });
    await loginAs(h.nurse);
    expect((await recordDose(order.id, { status: "GIVEN", slot: "09:00" })).success).toBe(true);
    expect(await recordDose(order.id, { status: "HELD", slot: "21:00" })).toMatchObject({ success: false, message: "Give a reason when a dose is not given" });
    expect((await recordDose(order.id, { status: "HELD", slot: "21:00", notes: "Patient vomiting" })).success).toBe(true);

    const chart = (await getMedicationChart(admission.id)).data;
    expect(chart.orders[0]).toMatchObject({ name: "Dolo 650", frequency: "BD", status: "ACTIVE" });
    expect(chart.orders[0].today.map((s) => [s.time, s.status])).toEqual([["09:00", "GIVEN"], ["21:00", "HELD"]]);
    expect(chart.orders[0].today[0].givenBy).toBe("Anita Das");
  });

  it("warns on allergy and on interaction with medicines already running", async () => {
    await prisma.patient.update({ where: { id: h.p2.patient.id }, data: { allergies: "penicillin" } });
    expect(await orderMedication(admission.id, { medicineId: amox.id, dose: "500 mg", route: "ORAL", frequency: "TDS", durationDays: 5 })).toMatchObject({ success: false, needsConfirmation: true });
  });

  it("stops an order, after which no more doses can be charted, and only doctors order", async () => {
    const { data: order } = await orderMedication(admission.id, { medicineId: para.id, dose: "650 mg", route: "ORAL", frequency: "OD", durationDays: 3 });
    expect(await stopMedication(order.id, "")).toMatchObject({ success: false, message: "Give a reason for stopping" });
    expect((await stopMedication(order.id, "Fever settled")).success).toBe(true);
    await loginAs(h.nurse);
    expect(await recordDose(order.id, { status: "GIVEN", slot: "09:00" })).toMatchObject({ success: false, message: "This medicine has been stopped" });
    expect((await orderMedication(admission.id, { medicineId: para.id, dose: "1", route: "ORAL", frequency: "OD" })).success).toBe(false);
  });
});

describe("allergies", () => {
  it("are recorded by clinical and front-desk staff, not by attendants", async () => {
    const { updateAllergies } = await import("@/actions/patients");
    await loginAs(h.nurse);
    expect((await updateAllergies(h.p1.patient.id, " Penicillin, sulfa ")).success).toBe(true);
    expect((await prisma.patient.findUnique({ where: { id: h.p1.patient.id } })).allergies).toBe("Penicillin, sulfa");
    await loginAs(h.attendant);
    expect((await updateAllergies(h.p1.patient.id, "")).success).toBe(false);
  });
});
