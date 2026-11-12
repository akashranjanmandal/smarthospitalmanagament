import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient } from "@/actions/admissions";
import { getAdmissionBill, postCharge, cancelCharge, recordPayment, finalizeBill, saveTariff, getTariffs } from "@/actions/ipd-billing";
import { seedWard } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, admission, cbc, visit;

beforeEach(async () => {
  h = await seedWard();
  await loginAs(h.admin);
  await saveTariff({ code: "BED-GENERAL", name: "General ward bed (per day)", category: "ROOM", price: 1500 });
  cbc = (await saveTariff({ code: "LAB-CBC", name: "Complete blood count", category: "LAB", price: 350 })).data;
  visit = (await saveTariff({ code: "CONS-VISIT", name: "Consultant visit", category: "CONSULTATION", price: 800 })).data;
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
});

describe("tariffs", () => {
  it("are managed by administrators and read by the billing desk", async () => {
    expect((await saveTariff({ code: "X", name: "x", category: "LAB", price: 1 })).success).toBe(false);
    const { data } = await getTariffs({});
    expect(data.map((t) => t.code)).toEqual(["BED-GENERAL", "CONS-VISIT", "LAB-CBC"]);
  });

  it("reject duplicate codes and negative prices", async () => {
    await loginAs(h.admin);
    expect(await saveTariff({ code: "LAB-CBC", name: "Again", category: "LAB", price: 10 })).toMatchObject({ success: false, message: "Tariff code LAB-CBC already exists" });
    expect(await saveTariff({ code: "NEW", name: "New", category: "LAB", price: -5 })).toMatchObject({ success: false, message: "Price must be zero or more" });
  });
});

describe("running bill", () => {
  it("starts with room charges for the bed type and grows as charges are posted", async () => {
    let { data } = await getAdmissionBill(admission.id);
    expect(data.totals.room).toEqual({ days: 1, rate: 1500, total: 1500 });

    expect((await postCharge(admission.id, { tariffId: cbc.id, quantity: 2 })).success).toBe(true);
    expect((await postCharge(admission.id, { tariffId: visit.id })).success).toBe(true);
    expect((await postCharge(admission.id, { description: "IV cannula", category: "CONSUMABLE", unitPrice: 120, quantity: 1, gstRate: 12 })).success).toBe(true);

    ({ data } = await getAdmissionBill(admission.id));
    expect(data.lines.map((l) => [l.description, l.amount])).toEqual([["Complete blood count", 700], ["Consultant visit", 800], ["IV cannula", 134.4]]);
    expect(data.lines[0].postedBy).toMatch(/RECEPTIONIST/);
    expect(data.totals.total).toBe(3134.4);
  });

  it("cancels a wrong charge with a reason, keeping it on record", async () => {
    const { data: line } = await postCharge(admission.id, { tariffId: cbc.id });
    expect(await cancelCharge(line.id, "")).toMatchObject({ success: false, message: "Give a reason for cancelling this charge" });
    expect((await cancelCharge(line.id, "Posted to wrong patient")).success).toBe(true);
    const { data } = await getAdmissionBill(admission.id);
    expect(data.lines[0]).toMatchObject({ cancelled: true, cancelReason: "Posted to wrong patient" });
    expect(data.totals.total).toBe(1500);
  });

  it("takes deposits and payments with receipt numbers, and refunds only what was received", async () => {
    const dep = await recordPayment(admission.id, { kind: "DEPOSIT", amount: 5000, method: "UPI", reference: "UPI123" });
    expect(dep.data.receiptNumber).toMatch(/^RCP-\d{4}-000001$/);
    expect(await recordPayment(admission.id, { kind: "REFUND", amount: 6000, method: "CASH" })).toMatchObject({ success: false, message: "Cannot refund more than ₹5000 received" });
    expect(await recordPayment(admission.id, { kind: "PAYMENT", amount: 0, method: "CASH" })).toMatchObject({ success: false, message: "Enter an amount greater than zero" });
    const { data } = await getAdmissionBill(admission.id);
    expect(data.totals).toMatchObject({ received: 5000, balanceDue: -3500 });
  });

  it("finalises once with a bill number, after which nothing more can be posted", async () => {
    await postCharge(admission.id, { tariffId: visit.id });
    const fin = await finalizeBill(admission.id, { discount: 300 });
    expect(fin.data).toMatchObject({ billNumber: expect.stringMatching(/^BL-\d{4}-000001$/), total: 2000 });
    expect(await postCharge(admission.id, { tariffId: cbc.id })).toMatchObject({ success: false, message: "The final bill has been prepared; no more charges can be added" });
    expect(await finalizeBill(admission.id, {})).toMatchObject({ success: false, message: "The final bill has already been prepared" });
    const { data } = await getAdmissionBill(admission.id);
    expect(data.finalized).toMatchObject({ billNumber: fin.data.billNumber });
    expect(data.totals.total).toBe(2000);
  });

  it("is closed to nurses and patients, read-only for the insurance desk", async () => {
    await loginAs(h.nurse);
    expect((await postCharge(admission.id, { tariffId: cbc.id })).success).toBe(false);
    await loginAs(h.p1.user);
    expect((await getAdmissionBill(admission.id)).success).toBe(false);
    const { prisma: db } = await import("@/lib/prisma");
    const desk = await db.user.create({ data: { email: "tpa@test.local", role: "INSURANCE_DESK", firstName: "Tpa" } });
    await loginAs(desk);
    expect((await getAdmissionBill(admission.id)).success).toBe(true);
    expect((await postCharge(admission.id, { tariffId: cbc.id })).success).toBe(false);
  });
});

describe("bill data", () => {
  it("records charges and payments in the audit trail", async () => {
    await postCharge(admission.id, { tariffId: cbc.id });
    await recordPayment(admission.id, { kind: "DEPOSIT", amount: 1000, method: "CASH" });
    const entities = (await prisma.auditLog.findMany({ select: { entity: true } })).map((e) => e.entity);
    expect(entities).toEqual(expect.arrayContaining(["AdmissionCharge", "AdmissionPayment"]));
  });
});
