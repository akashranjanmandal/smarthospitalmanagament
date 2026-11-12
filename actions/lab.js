"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { nextSequence } from "@/lib/audit/extension";
import { evaluateResults } from "@/lib/lab/results";
import { istDateString } from "@/lib/dates";

const CAN_RESULT = ["LAB_TECH", "ADMIN", "SUPER_ADMIN"];
const CAN_ACK = ["DOCTOR", "NURSE", "ADMIN", "SUPER_ADMIN"];

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const fullName = (u) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : null);
const refresh = (admissionId) => {
  revalidatePath("/lab");
  revalidatePath("/lab-reports");
  if (admissionId) revalidatePath(`/admissions/${admissionId}`);
};

// ─── Catalogue ──────────────────────────────────────────────────────────────

export async function saveLabTest(data = {}) {
  try {
    await guardAction("labCatalog", data.id ? "update" : "create");
    const code = data.code?.trim().toUpperCase();
    const name = data.name?.trim();
    const price = Number(data.price);
    if (!code || !name) return { success: false, message: "Enter a code and a name" };
    if (!["LAB", "RADIOLOGY"].includes(data.department)) return { success: false, message: "Choose laboratory or radiology" };
    if (!Number.isFinite(price) || price < 0) return { success: false, message: "Price must be zero or more" };
    if (!Array.isArray(data.parameters)) return { success: false, message: "Parameters must be a list" };
    if (data.parameters.some((p) => !p?.name)) return { success: false, message: "Every parameter needs a name" };
    const clash = await prisma.labTest.findFirst({ where: { code, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
    if (clash) return { success: false, message: `Test code ${code} already exists` };
    const values = {
      code, name, department: data.department, sampleType: data.sampleType?.trim() || null, price, parameters: data.parameters,
      turnaroundHours: data.turnaroundHours ? Number(data.turnaroundHours) : null, active: data.active ?? true,
    };
    const test = data.id ? await prisma.labTest.update({ where: { id: data.id }, data: values }) : await prisma.labTest.create({ data: values });
    revalidatePath("/lab/tests");
    return { success: true, message: `${name} saved`, data: test };
  } catch (error) {
    return failed(error, "Failed to save the test");
  }
}

export async function getLabCatalog({ includeInactive = false } = {}) {
  try {
    await guardAction("labOrders", "read");
    const tests = await prisma.labTest.findMany({ where: includeInactive ? {} : { active: true }, orderBy: [{ code: "asc" }] });
    return { success: true, data: tests };
  } catch (error) {
    return failed(error, "Failed to load tests");
  }
}

// ─── Orders ─────────────────────────────────────────────────────────────────

/** Doctor orders one or more tests for an in-patient stay or an OPD consultation. */
export async function orderTests(target = {}, { testIds = [], priority = "ROUTINE", clinicalNotes } = {}) {
  try {
    const { user } = await guardAction("labOrders", "create");
    if (!["ROUTINE", "URGENT"].includes(priority)) return { success: false, message: "Choose routine or urgent" };
    if (!testIds.length) return { success: false, message: "Choose at least one test" };

    let patientId;
    if (target.admissionId) {
      const a = await prisma.admission.findUnique({ where: { id: target.admissionId }, select: { status: true, patientId: true } });
      if (!a) return { success: false, message: "Admission not found" };
      if (a.status !== "ADMITTED") return { success: false, message: "This patient has been discharged" };
      patientId = a.patientId;
    } else if (target.medicalRecordId) {
      const r = await prisma.medicalRecord.findUnique({ where: { id: target.medicalRecordId }, select: { patientId: true } });
      if (!r) return { success: false, message: "Consultation not found" };
      patientId = r.patientId;
    } else {
      return { success: false, message: "Choose the patient's stay or consultation" };
    }

    const tests = await prisma.labTest.findMany({ where: { id: { in: testIds }, active: true }, select: { id: true, name: true } });
    if (tests.length !== testIds.length) return { success: false, message: "One of the chosen tests is not available" };

    const year = new Date().getFullYear();
    const created = [];
    for (const testId of testIds) {
      const orderNumber = `LAB-${year}-${String(await nextSequence(prisma, `lab-${year}`)).padStart(6, "0")}`;
      created.push(await prisma.labOrder.create({
        data: { orderNumber, testId, patientId, admissionId: target.admissionId ?? null, medicalRecordId: target.medicalRecordId ?? null, orderedById: user.id, priority, clinicalNotes: clinicalNotes?.trim() || null },
        select: { id: true, orderNumber: true },
      }));
    }
    refresh(target.admissionId);
    return { success: true, message: `${tests.length} test${tests.length === 1 ? "" : "s"} ordered${priority === "URGENT" ? " (urgent)" : ""}`, data: created };
  } catch (error) {
    return failed(error, "Failed to order tests");
  }
}

/** Sample taken (or patient seen in radiology): issue the sample number and bill in-patients. */
export async function collectSample(orderId) {
  try {
    const { user } = await guardAction("labOrders", "update");
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, include: { test: true, admission: { select: { id: true, status: true, billFinalizedAt: true } } } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status === "CANCELLED") return { success: false, message: "This test was cancelled" };
    if (order.status !== "ORDERED") return { success: false, message: "Sample already collected" };

    const day = istDateString().replace(/-/g, "");
    const accessionNumber = `S${day}-${String(await nextSequence(prisma, `accession-${day}`)).padStart(4, "0")}`;
    await prisma.$transaction(async (tx) => {
      await tx.labOrder.update({ where: { id: order.id, status: "ORDERED" }, data: { status: "COLLECTED", accessionNumber, collectedAt: new Date(), collectedById: user.id } });
      if (order.admission?.status === "ADMITTED" && !order.admission.billFinalizedAt) {
        await tx.admissionCharge.create({
          data: { admissionId: order.admission.id, description: order.test.name, category: order.test.department === "LAB" ? "LAB" : "RADIOLOGY", quantity: 1, unitPrice: order.test.price, gstRate: 0, postedById: user.id },
        });
      }
    });
    refresh(order.admissionId);
    return { success: true, message: order.test.department === "LAB" ? `Sample ${accessionNumber} collected — label the tube` : `${order.test.name} performed (${accessionNumber})`, data: { accessionNumber } };
  } catch (error) {
    if (error.code === "P2025") return { success: false, message: "Sample already collected" };
    return failed(error, "Failed to record the sample");
  }
}

export async function enterResults(orderId, { values, reportText } = {}) {
  try {
    const { user, role } = await guardAction("labOrders", "update");
    if (!CAN_RESULT.includes(role)) return { success: false, message: "Only the lab can enter results" };
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, include: { test: true } });
    if (!order) return { success: false, message: "Order not found" };
    if (!["COLLECTED", "RESULTED"].includes(order.status)) {
      return { success: false, message: order.status === "ORDERED" ? "Collect the sample first" : "Results are already verified" };
    }

    const params = Array.isArray(order.test.parameters) ? order.test.parameters : [];
    let data;
    if (params.length === 0) {
      if (!reportText?.trim()) return { success: false, message: "Write the report" };
      data = { reportText: reportText.trim(), results: null, abnormal: false, critical: false };
    } else {
      const check = evaluateResults(params, values);
      if (!check.ok) return { success: false, message: check.message };
      data = { results: check.results, abnormal: check.abnormal, critical: check.critical, reportText: reportText?.trim() || null };
    }
    await prisma.labOrder.update({ where: { id: orderId }, data: { ...data, status: "RESULTED", resultedAt: new Date(), resultedById: user.id } });
    refresh(order.admissionId);
    return { success: true, message: data.critical ? "Results saved — CRITICAL values, verify and inform the doctor" : "Results saved — waiting for verification", data: { critical: data.critical } };
  } catch (error) {
    return failed(error, "Failed to save results");
  }
}

/** A second person checks and releases the results to the doctor and patient. */
export async function verifyResults(orderId) {
  try {
    const { user, role } = await guardAction("labOrders", "update");
    if (!CAN_RESULT.includes(role)) return { success: false, message: "Only the lab can verify results" };
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, resultedById: true, admissionId: true, critical: true } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status !== "RESULTED") return { success: false, message: "There are no results waiting for verification" };
    if (order.resultedById === user.id) return { success: false, message: "Results must be verified by a second person" };
    await prisma.labOrder.update({ where: { id: orderId }, data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: user.id } });
    refresh(order.admissionId);
    return { success: true, message: order.critical ? "Verified — critical result alert sent to the doctor and ward" : "Results verified and released" };
  } catch (error) {
    return failed(error, "Failed to verify results");
  }
}

export async function acknowledgeCritical(orderId) {
  try {
    const { user, role } = await guardAction("labOrders", "read");
    if (!CAN_ACK.includes(role)) return { success: false, message: "Only doctors and nurses acknowledge critical results" };
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true, critical: true, status: true, criticalAckAt: true, admissionId: true } });
    if (!order || !order.critical || order.status !== "VERIFIED") return { success: false, message: "No critical result to acknowledge" };
    if (order.criticalAckAt) return { success: false, message: "Already acknowledged" };
    await prisma.labOrder.update({ where: { id: orderId }, data: { criticalAckAt: new Date(), criticalAckById: user.id } });
    refresh(order.admissionId);
    revalidatePath("/dashboard");
    return { success: true, message: "Critical result acknowledged" };
  } catch (error) {
    return failed(error, "Failed to acknowledge");
  }
}

// ─── Views ──────────────────────────────────────────────────────────────────

const ORDER_VIEW = {
  test: { select: { id: true, code: true, name: true, department: true, sampleType: true, parameters: true, turnaroundHours: true } },
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
  admission: { select: { id: true, admissionNumber: true, bed: { select: { bedNumber: true, ward: { select: { name: true } } } } } },
};

export async function getLabWorklist() {
  try {
    await guardAction("labOrders", "update");
    const start = new Date(`${istDateString()}T00:00:00+05:30`);
    const [toCollect, inLab, toVerify, doneToday] = await Promise.all([
      prisma.labOrder.findMany({ where: { status: "ORDERED" }, include: ORDER_VIEW, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }),
      prisma.labOrder.findMany({ where: { status: "COLLECTED" }, include: ORDER_VIEW, orderBy: [{ priority: "desc" }, { collectedAt: "asc" }] }),
      prisma.labOrder.findMany({ where: { status: "RESULTED" }, include: ORDER_VIEW, orderBy: [{ critical: "desc" }, { resultedAt: "asc" }] }),
      prisma.labOrder.findMany({ where: { status: "VERIFIED", verifiedAt: { gte: start } }, include: ORDER_VIEW, orderBy: { verifiedAt: "desc" }, take: 50 }),
    ]);
    return { success: true, data: { toCollect, inLab, toVerify, doneToday } };
  } catch (error) {
    return failed(error, "Failed to load the lab worklist");
  }
}

/** Results for a stay, consultation or patient. Values are shown only once verified; patients see only their own verified reports. */
export async function getLabResults({ admissionId, medicalRecordId, patientId } = {}) {
  try {
    const { user, role } = await guardAction("labOrders", "read");
    const where = {};
    if (role === "PATIENT") {
      Object.assign(where, { patient: { userId: user.id }, status: "VERIFIED" });
    } else {
      if (admissionId) where.admissionId = admissionId;
      if (medicalRecordId) where.medicalRecordId = medicalRecordId;
      if (patientId) where.patientId = patientId;
      if (!admissionId && !medicalRecordId && !patientId) return { success: false, message: "Choose a patient" };
    }
    const orders = await prisma.labOrder.findMany({ where, include: ORDER_VIEW, orderBy: { createdAt: "desc" }, take: 200 });
    const ids = [...new Set(orders.flatMap((o) => [o.orderedById, o.collectedById, o.resultedById, o.verifiedById, o.criticalAckById]).filter(Boolean))];
    const staff = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, fullName(u)]));
    return {
      success: true,
      data: orders.map((o) => {
        const released = o.status === "VERIFIED";
        return {
          id: o.id, orderNumber: o.orderNumber, accessionNumber: o.accessionNumber, status: o.status, priority: o.priority, clinicalNotes: o.clinicalNotes,
          test: o.test, patient: o.patient, admissionId: o.admissionId,
          results: released ? o.results : null, reportText: released ? o.reportText : null,
          abnormal: released && o.abnormal, critical: released && o.critical,
          createdAt: o.createdAt, collectedAt: o.collectedAt, resultedAt: o.resultedAt, verifiedAt: o.verifiedAt, criticalAckAt: o.criticalAckAt,
          orderedBy: staff.get(o.orderedById) ?? null, collectedBy: staff.get(o.collectedById) ?? null,
          resultedBy: staff.get(o.resultedById) ?? null, verifiedBy: staff.get(o.verifiedById) ?? null, criticalAckBy: staff.get(o.criticalAckById) ?? null,
        };
      }),
    };
  } catch (error) {
    return failed(error, "Failed to load results");
  }
}

/** Unacknowledged critical results: a doctor's own patients; nurses see all in-patients. */
export async function getCriticalAlerts() {
  try {
    const { user, role } = await guardAction("labOrders", "read");
    if (!CAN_ACK.includes(role)) return { success: true, data: [] };
    const where = { critical: true, status: "VERIFIED", criticalAckAt: null };
    if (role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true } });
      where.OR = [{ orderedById: user.id }, { admission: { doctorId: doc?.id ?? "-" } }, { medicalRecord: { doctorId: doc?.id ?? "-" } }];
    } else if (role === "NURSE") {
      where.admission = { status: "ADMITTED" };
    }
    const orders = await prisma.labOrder.findMany({ where, include: ORDER_VIEW, orderBy: { verifiedAt: "asc" } });
    return {
      success: true,
      data: orders.map((o) => ({
        orderId: o.id, patientName: fullName(o.patient), uhid: o.patient.uhid, testName: o.test.name, admissionId: o.admissionId,
        bed: o.admission?.bed?.bedNumber ?? null, verifiedAt: o.verifiedAt,
        values: (o.results ?? []).filter((r) => r.flag === "LL" || r.flag === "HH"),
      })),
    };
  } catch (error) {
    return failed(error, "Failed to load alerts");
  }
}
