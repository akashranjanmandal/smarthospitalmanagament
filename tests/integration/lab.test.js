import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient } from "@/actions/admissions";
import { getAdmissionBill } from "@/actions/ipd-billing";
import { saveLabTest, getLabCatalog, orderTests, collectSample, enterResults, verifyResults, acknowledgeCritical, getLabWorklist, getLabResults, getCriticalAlerts } from "@/actions/lab";
import { seedWard, createUser, createAppointment } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, tech1, tech2, admission, cbc, xray, ns1;

beforeEach(async () => {
  h = await seedWard();
  tech1 = await createUser({ role: "LAB_TECH", firstName: "Lata", lastName: "Shah" });
  tech2 = await createUser({ role: "LAB_TECH", firstName: "Imran", lastName: "Ali" });
  await loginAs(h.admin);
  cbc = (await saveLabTest({
    code: "LAB-CBC", name: "Complete blood count", department: "LAB", sampleType: "Blood (EDTA)", price: 350,
    parameters: [
      { name: "Haemoglobin", unit: "g/dL", low: 12, high: 16, criticalLow: 7 },
      { name: "Platelets", unit: "/µL", low: 150000, high: 450000, criticalLow: 20000 },
    ],
  })).data;
  ns1 = (await saveLabTest({ code: "LAB-NS1", name: "Dengue NS1", department: "LAB", sampleType: "Blood (serum)", price: 900, parameters: [{ name: "NS1 antigen", type: "choice", options: ["Negative", "Positive"], abnormal: ["Positive"] }] })).data;
  xray = (await saveLabTest({ code: "RAD-XRAY-CHEST", name: "X-ray chest PA", department: "RADIOLOGY", price: 450, parameters: [] })).data;
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
  await loginAs(h.doctorUser);
});

describe("test catalogue", () => {
  it("is maintained by administrators and readable by doctors", async () => {
    expect((await saveLabTest({ code: "X", name: "x", department: "LAB", price: 1, parameters: [] })).success).toBe(false);
    expect((await getLabCatalog()).data.map((t) => t.code)).toEqual(["LAB-CBC", "LAB-NS1", "RAD-XRAY-CHEST"]);
  });
});

describe("ordering and collecting", () => {
  it("lets the doctor order several tests at once, urgent first in the lab's list", async () => {
    const res = await orderTests({ admissionId: admission.id }, { testIds: [cbc.id, xray.id], priority: "URGENT", clinicalNotes: "?dengue" });
    expect(res.success).toBe(true);
    expect(res.data.map((o) => o.orderNumber)).toEqual([expect.stringMatching(/^LAB-\d{4}-000001$/), expect.stringMatching(/-000002$/)]);
    await loginAs(tech1);
    const { data } = await getLabWorklist();
    expect(data.toCollect.map((o) => [o.test.name, o.priority])).toEqual([["Complete blood count", "URGENT"], ["X-ray chest PA", "URGENT"]]);
  });

  it("issues a sample number on collection and bills in-patients", async () => {
    const [order] = (await orderTests({ admissionId: admission.id }, { testIds: [cbc.id] })).data;
    await loginAs(h.nurse);
    const col = await collectSample(order.id);
    expect(col.data.accessionNumber).toMatch(/^S\d{8}-\d{4}$/);
    expect(await collectSample(order.id)).toMatchObject({ success: false, message: "Sample already collected" });
    await loginAs(h.receptionist);
    const bill = (await getAdmissionBill(admission.id)).data;
    expect(bill.lines.map((l) => [l.description, l.category, l.unitPrice])).toEqual([["Complete blood count", "LAB", 350]]);
  });

  it("works for out-patients from their consultation", async () => {
    const appt = await createAppointment({ doctorId: h.doctor.id, patientId: h.p2.patient.id });
    const record = await prisma.medicalRecord.create({ data: { patientId: h.p2.patient.id, doctorId: h.doctor.id, appointmentId: appt.id } });
    expect((await orderTests({ medicalRecordId: record.id }, { testIds: [ns1.id] })).success).toBe(true);
  });

  it("is ordered only by doctors", async () => {
    await loginAs(h.nurse);
    expect((await orderTests({ admissionId: admission.id }, { testIds: [cbc.id] })).success).toBe(false);
  });
});

describe("results", () => {
  let order;
  beforeEach(async () => {
    [order] = (await orderTests({ admissionId: admission.id }, { testIds: [cbc.id] })).data;
    await loginAs(tech1);
    await collectSample(order.id);
  });

  it("are entered against reference ranges, flagged, and need a second person to verify", async () => {
    const entered = await enterResults(order.id, { values: { Haemoglobin: "6.4", Platelets: "98000" } });
    expect(entered).toMatchObject({ success: true, data: { critical: true } });
    expect(await verifyResults(order.id)).toMatchObject({ success: false, message: "Results must be verified by a second person" });

    await loginAs(h.doctorUser);
    expect((await getLabResults({ admissionId: admission.id })).data[0].results).toBeNull();

    await loginAs(tech2);
    expect((await verifyResults(order.id)).success).toBe(true);

    await loginAs(h.doctorUser);
    const shown = (await getLabResults({ admissionId: admission.id })).data[0];
    expect(shown).toMatchObject({ status: "VERIFIED", critical: true, results: [{ name: "Haemoglobin", flag: "LL" }, { name: "Platelets", flag: "L" }] });
  });

  it("raises a critical alert for the doctor and nurse until acknowledged", async () => {
    await enterResults(order.id, { values: { Haemoglobin: "6.4", Platelets: "98000" } });
    await loginAs(tech2);
    await verifyResults(order.id);

    await loginAs(h.doctorUser);
    const alerts = (await getCriticalAlerts()).data;
    expect(alerts.map((a) => [a.patientName, a.testName])).toEqual([["Sanjay Verma", "Complete blood count"]]);
    await loginAs(h.nurse);
    expect((await getCriticalAlerts()).data).toHaveLength(1);
    expect((await acknowledgeCritical(order.id)).success).toBe(true);
    expect((await getCriticalAlerts()).data).toHaveLength(0);
  });

  it("takes a written report for radiology", async () => {
    await loginAs(h.doctorUser);
    const [x] = (await orderTests({ admissionId: admission.id }, { testIds: [xray.id] })).data;
    await loginAs(tech1);
    await collectSample(x.id);
    expect(await enterResults(x.id, {})).toMatchObject({ success: false, message: "Write the report" });
    expect((await enterResults(x.id, { reportText: "Lungs clear. No consolidation." })).success).toBe(true);
  });

  it("shows patients only their own verified reports", async () => {
    await enterResults(order.id, { values: { Haemoglobin: "13", Platelets: "220000" } });
    await loginAs(h.p1.user);
    expect((await getLabResults({})).data).toHaveLength(0);
    await loginAs(tech2);
    await verifyResults(order.id);
    await loginAs(h.p1.user);
    expect((await getLabResults({})).data.map((r) => r.status)).toEqual(["VERIFIED"]);
    await loginAs(h.p2.user);
    expect((await getLabResults({})).data).toHaveLength(0);
  });
});
