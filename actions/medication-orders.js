"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { checkPrescription } from "@/lib/pharmacy/safety";
import { doseTimes, dosesPerDay } from "@/lib/pharmacy/dosing";
import { createPharmacyOrder } from "@/lib/pharmacy/orders";
import { istDateString } from "@/lib/dates";

const ROUTES = ["ORAL", "IV", "IM", "SC", "INHALED", "TOPICAL", "SUBLINGUAL", "RECTAL", "NASAL", "EYE", "EAR"];
const FREQUENCIES = ["OD", "BD", "TDS", "QID", "HS", "SOS", "STAT"];

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const refresh = (admissionId) => {
  revalidatePath(`/admissions/${admissionId}`);
  revalidatePath("/pharmacy");
};
const fullName = (u) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : null);

/** Doctor orders a medicine for an in-patient; a ward indent goes to the pharmacy automatically. */
export async function orderMedication(admissionId, data = {}) {
  try {
    const { user } = await guardAction("medicationOrders", "create");
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, status: true, patientId: true, patient: { select: { allergies: true } }, medicationOrders: { where: { status: "ACTIVE" }, include: { medicine: true } } },
    });
    if (!admission) return { success: false, message: "Admission not found" };
    if (admission.status !== "ADMITTED") return { success: false, message: "This patient has been discharged" };
    const medicine = data.medicineId ? await prisma.medicine.findFirst({ where: { id: data.medicineId, active: true } }) : null;
    if (!medicine) return { success: false, message: "Choose a medicine from the formulary" };
    if (!data.dose?.trim()) return { success: false, message: "Enter the dose" };
    if (!ROUTES.includes(data.route)) return { success: false, message: "Choose the route" };
    if (!FREQUENCIES.includes(data.frequency)) return { success: false, message: "Choose how often" };
    const durationDays = data.durationDays ? Number(data.durationDays) : null;
    if (durationDays != null && (!Number.isInteger(durationDays) || durationDays <= 0)) return { success: false, message: "Duration must be a whole number of days" };

    const warnings = checkPrescription({
      items: [{ name: medicine.name, genericName: medicine.genericName }],
      allergies: admission.patient.allergies,
      current: admission.medicationOrders.map((o) => ({ name: o.medicine.name, genericName: o.medicine.genericName })),
    });
    if (warnings.length && !data.acknowledgeWarnings) {
      return { success: false, needsConfirmation: true, warnings, message: "Check these warnings before ordering" };
    }

    const order = await prisma.medicationOrder.create({
      data: {
        admissionId, medicineId: medicine.id, name: medicine.name, dose: data.dose.trim(), route: data.route, frequency: data.frequency,
        durationDays, instructions: data.instructions?.trim() || null, orderedById: user.id,
      },
    });
    // Supply for the course (or one day if open-ended / as needed), one unit per dose.
    const perDay = data.frequency === "STAT" ? 1 : Math.max(1, dosesPerDay(data.frequency));
    const quantity = data.frequency === "STAT" ? 1 : perDay * (durationDays ?? 1);
    const indent = await createPharmacyOrder({
      source: "IPD", patientId: admission.patientId, admissionId, medicationOrderId: order.id,
      items: [{ medicineId: medicine.id, name: medicine.name, dose: order.dose, frequency: order.frequency, duration: durationDays ? `${durationDays} days` : null, quantity }],
    });
    refresh(admissionId);
    return { success: true, message: `${medicine.name} ordered — indent ${indent.orderNumber} sent to pharmacy`, data: order, warnings };
  } catch (error) {
    return failed(error, "Failed to order the medicine");
  }
}

export async function stopMedication(orderId, reason) {
  try {
    const { user } = await guardAction("medicationOrders", "update");
    const order = await prisma.medicationOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, admissionId: true } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status === "STOPPED") return { success: false, message: "This medicine is already stopped" };
    if (!reason?.trim()) return { success: false, message: "Give a reason for stopping" };
    await prisma.medicationOrder.update({ where: { id: orderId }, data: { status: "STOPPED", stoppedAt: new Date(), stoppedById: user.id, stopReason: reason.trim() } });
    refresh(order.admissionId);
    return { success: true, message: "Medicine stopped" };
  } catch (error) {
    return failed(error, "Failed to stop the medicine");
  }
}

/** Nurse charts a dose: given, held or refused (with a reason), against today's ward-round slot. */
export async function recordDose(orderId, { status, slot, notes } = {}) {
  try {
    const { user } = await guardAction("nursing", "create");
    const order = await prisma.medicationOrder.findUnique({ where: { id: orderId }, include: { admission: { select: { status: true } } } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status === "STOPPED") return { success: false, message: "This medicine has been stopped" };
    if (order.admission.status !== "ADMITTED") return { success: false, message: "This patient has been discharged" };
    if (!["GIVEN", "HELD", "REFUSED"].includes(status)) return { success: false, message: "Choose given, held or refused" };
    if (status !== "GIVEN" && !notes?.trim()) return { success: false, message: "Give a reason when a dose is not given" };
    const allowed = doseTimes(order.frequency);
    const slotKey = allowed.length ? slot : slot || new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    if (allowed.length && !allowed.includes(slotKey)) return { success: false, message: "Choose one of this medicine's dose times" };
    const doseDate = istDateString();

    const existing = await prisma.medicationAdministration.findUnique({ where: { orderId_doseDate_slot: { orderId, doseDate, slot: slotKey } } });
    if (existing) return { success: false, message: `The ${slotKey} dose is already charted` };
    await prisma.medicationAdministration.create({ data: { orderId, doseDate, slot: slotKey, status, notes: notes?.trim() || null, givenById: user.id } });
    refresh(order.admissionId);
    return { success: true, message: status === "GIVEN" ? `${order.name} ${slotKey} dose recorded` : `${order.name} ${slotKey} dose marked ${status.toLowerCase()}` };
  } catch (error) {
    return failed(error, "Failed to record the dose");
  }
}

/** Medication chart: every order with today's dose slots and what happened at each. */
export async function getMedicationChart(admissionId) {
  try {
    const { role } = await guardAction("admissions", "read");
    if (role === "PATIENT") return { success: false, message: "Not available" };
    const today = istDateString();
    const orders = await prisma.medicationOrder.findMany({
      where: { admissionId },
      include: { medicine: { select: { strength: true, form: true } }, administrations: { orderBy: { givenAt: "asc" } }, pharmacyOrder: { select: { orderNumber: true, status: true } } },
      orderBy: [{ status: "asc" }, { startAt: "asc" }],
    });
    const staffIds = [...new Set(orders.flatMap((o) => [o.orderedById, o.stoppedById, ...o.administrations.map((a) => a.givenById)]).filter(Boolean))];
    const staff = new Map((await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, fullName(u)]));

    return {
      success: true,
      data: {
        today,
        orders: orders.map((o) => {
          const todays = o.administrations.filter((a) => a.doseDate === today);
          const slots = doseTimes(o.frequency);
          const slotsToday = (slots.length ? slots : todays.map((a) => a.slot)).map((time) => {
            const a = todays.find((x) => x.slot === time);
            return { time, status: a?.status ?? "DUE", notes: a?.notes ?? null, givenBy: a ? staff.get(a.givenById) ?? null : null, givenAt: a?.givenAt ?? null };
          });
          return {
            id: o.id, name: o.name, strength: o.medicine.strength, form: o.medicine.form, dose: o.dose, route: o.route, frequency: o.frequency,
            durationDays: o.durationDays, instructions: o.instructions, status: o.status, startAt: o.startAt,
            orderedBy: staff.get(o.orderedById) ?? null, stoppedAt: o.stoppedAt, stopReason: o.stopReason, stoppedBy: staff.get(o.stoppedById) ?? null,
            supply: o.pharmacyOrder, today: slotsToday,
            history: o.administrations.map((a) => ({ ...a, givenBy: staff.get(a.givenById) ?? null })),
          };
        }),
      },
    };
  } catch (error) {
    return failed(error, "Failed to load the medication chart");
  }
}
