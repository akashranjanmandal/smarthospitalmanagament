import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient, dischargePatient } from "@/actions/admissions";
import { saveTariff, postCharge, finalizeBill, getAdmissionBill } from "@/actions/ipd-billing";
import { setPayer, requestPreAuth, respondPreAuth, submitClaim, settleClaim, getInsuranceWorklist } from "@/actions/insurance";
import { seedWard, createUser } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, admission, desk, lab;
const payer = { payerType: "INSURANCE", insurerName: "Star Health", tpaName: "Medi Assist", policyNumber: "P-998877", memberId: "M-1", sumInsured: 300000, policyValidTill: "2027-03-31" };
const discharge = () => dischargePatient(admission.id, { finalDiagnosis: "Dengue", conditionAtDischarge: "RECOVERED" });

beforeEach(async () => {
  h = await seedWard();
  desk = await createUser({ role: "INSURANCE_DESK", firstName: "Farah", lastName: "Khan" });
  await loginAs(h.admin);
  await saveTariff({ code: "BED-GENERAL", name: "General bed", category: "ROOM", price: 2000 });
  lab = (await saveTariff({ code: "LAB-PLT", name: "Platelet count", category: "LAB", price: 500 })).data;
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
});

describe("payer details", () => {
  it("are captured by the front desk and need insurer and policy number for insured patients", async () => {
    expect(await setPayer(admission.id, { payerType: "INSURANCE", insurerName: "" })).toMatchObject({ success: false, message: "Enter the insurer / scheme name" });
    expect((await setPayer(admission.id, payer)).success).toBe(true);
    const saved = await prisma.admission.findUnique({ where: { id: admission.id } });
    expect(saved).toMatchObject({ payerType: "INSURANCE", insurerName: "Star Health", policyNumber: "P-998877", sumInsured: 300000 });
  });

  it("flags an expired policy", async () => {
    expect(await setPayer(admission.id, { ...payer, policyValidTill: "2020-01-01" })).toMatchObject({ success: false, message: "This policy expired on 01 Jan 2020" });
  });
});

describe("pre-authorisation", () => {
  beforeEach(async () => { await setPayer(admission.id, payer); await loginAs(desk); });

  it("is requested by the desk and answered with the insurer's decision", async () => {
    const req = await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 40000, remarks: "Dengue, 4 days" });
    expect(req.success).toBe(true);
    expect(await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 1000 })).toMatchObject({ success: false, message: "An initial pre-authorisation already exists" });

    expect(await respondPreAuth(req.data.id, { status: "APPROVED", approvedAmount: 50000 })).toMatchObject({ success: false, message: "Approved amount cannot be more than requested (₹40000)" });
    expect((await respondPreAuth(req.data.id, { status: "APPROVED", approvedAmount: 30000, referenceNumber: "AL-1" })).success).toBe(true);

    const { data } = await getAdmissionBill(admission.id);
    expect(data.insurance).toMatchObject({ approvedAmount: 30000, usage: { level: "ok" } });
  });

  it("adds enhancements to the approved amount", async () => {
    const first = await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 2000 });
    await respondPreAuth(first.data.id, { status: "APPROVED", approvedAmount: 2000 });
    const more = await requestPreAuth(admission.id, { kind: "ENHANCEMENT", requestedAmount: 3000, remarks: "Platelets falling" });
    await respondPreAuth(more.data.id, { status: "APPROVED", approvedAmount: 2500 });
    expect((await getAdmissionBill(admission.id)).data.insurance.approvedAmount).toBe(4500);
  });

  it("needs an approved initial request before an enhancement, and is refused for self-paying patients", async () => {
    expect(await requestPreAuth(admission.id, { kind: "ENHANCEMENT", requestedAmount: 100 })).toMatchObject({ success: false, message: "Get the initial pre-authorisation approved first" });
    await loginAs(h.receptionist);
    await setPayer(admission.id, { payerType: "SELF" });
    await loginAs(desk);
    expect(await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 100 })).toMatchObject({ success: false, message: "This patient is paying themselves" });
  });

  it("warns the desk when the running bill reaches 80% of the approved amount", async () => {
    const first = await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 3000 });
    await respondPreAuth(first.data.id, { status: "APPROVED", approvedAmount: 3000 });
    await loginAs(h.receptionist);
    await postCharge(admission.id, { tariffId: lab.id });
    await loginAs(desk);
    const { data } = await getInsuranceWorklist();
    expect(data.nearLimit.map((n) => [n.admissionNumber, n.usage.percent])).toEqual([[admission.admissionNumber, 83]]);
  });

  it("is only answered by the insurance desk", async () => {
    const req = await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 1000 });
    await loginAs(h.receptionist);
    expect((await respondPreAuth(req.data.id, { status: "APPROVED", approvedAmount: 1000 })).success).toBe(false);
  });
});

describe("discharge and claim", () => {
  beforeEach(async () => {
    await setPayer(admission.id, payer);
    await loginAs(desk);
    const first = await requestPreAuth(admission.id, { kind: "INITIAL", requestedAmount: 10000 });
    await respondPreAuth(first.data.id, { status: "APPROVED", approvedAmount: 10000 });
  });

  it("holds discharge of an insured patient until the insurer's final approval", async () => {
    await loginAs(h.doctorUser);
    expect(await discharge()).toMatchObject({ success: false, message: "Waiting for final approval from the insurer" });

    await loginAs(desk);
    expect(await requestPreAuth(admission.id, { kind: "FINAL" })).toMatchObject({ success: false, message: "Prepare the final bill before requesting final approval" });
    await loginAs(h.receptionist);
    await finalizeBill(admission.id, {});
    await loginAs(desk);
    const fin = await requestPreAuth(admission.id, { kind: "FINAL" });
    expect(fin.data.requestedAmount).toBe(2000);
    await respondPreAuth(fin.data.id, { status: "APPROVED", approvedAmount: 1800 });

    await loginAs(h.doctorUser);
    expect((await discharge()).success).toBe(true);
    await loginAs(desk);
    const { data } = await getAdmissionBill(admission.id);
    expect(data.totals).toMatchObject({ insurerPays: 1800, patientShare: 200 });
  });

  it("files and settles the claim, requiring reasons for any deduction", async () => {
    await loginAs(h.receptionist);
    await finalizeBill(admission.id, {});
    await loginAs(desk);
    expect(await submitClaim(admission.id, {})).toMatchObject({ success: false, message: "Discharge the patient before filing the claim" });
    const fin = await requestPreAuth(admission.id, { kind: "FINAL" });
    await respondPreAuth(fin.data.id, { status: "APPROVED", approvedAmount: 2000 });
    await loginAs(h.doctorUser);
    await discharge();
    await loginAs(desk);

    const claim = await submitClaim(admission.id, {});
    expect(claim.data).toMatchObject({ claimNumber: expect.stringMatching(/^CLM-\d{4}-000001$/), claimedAmount: 2000 });
    expect(await submitClaim(admission.id, {})).toMatchObject({ success: false, message: "A claim has already been filed for this stay" });

    expect(await settleClaim(claim.data.id, { status: "SETTLED", settledAmount: 1700, deductions: [] })).toMatchObject({ success: false, message: "Record the reasons for the ₹300 deduction" });
    const settled = await settleClaim(claim.data.id, { status: "SETTLED", settledAmount: 1700, utrNumber: "UTR555", deductions: [{ reason: "Non-payable consumables", amount: 300 }] });
    expect(settled.success).toBe(true);

    const { data } = await getInsuranceWorklist();
    expect(data.stats).toMatchObject({ claimed: 2000, settled: 1700, deducted: 300 });
    expect(data.openClaims).toHaveLength(0);
  });
});
