"use server";

import { prisma, withTransaction } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { allocateFefo } from "@/lib/pharmacy/stock";
import { lineAmount } from "@/lib/ipd-billing";

const FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "INFUSION", "CREAM", "DROPS", "INHALER", "POWDER", "OTHER"];
const SCHEDULES = ["OTC", "H", "H1", "X"];

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "Only the pharmacy can do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const refresh = () => {
  revalidatePath("/pharmacy");
  revalidatePath("/pharmacy/formulary");
  revalidatePath("/prescriptions");
};
const medicineLabel = (m) => `${m.name}${m.strength ? ` (${m.strength})` : ""}`;

// ─── Formulary and stock ────────────────────────────────────────────────────

export async function saveMedicine(data = {}) {
  try {
    await guardAction("formulary", data.id ? "update" : "create");
    const name = data.name?.trim();
    const genericName = data.genericName?.trim();
    const unitPrice = Number(data.unitPrice);
    if (!name || !genericName) return { success: false, message: "Enter the brand and generic names" };
    if (!FORMS.includes(data.form)) return { success: false, message: "Choose the dosage form" };
    if (data.schedule && !SCHEDULES.includes(data.schedule)) return { success: false, message: "Choose a valid schedule" };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { success: false, message: "Enter a valid price" };
    const clash = await prisma.medicine.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
    if (clash) return { success: false, message: `${name} is already in the formulary` };

    const values = {
      name, genericName, strength: data.strength?.trim() || null, form: data.form, schedule: data.schedule || null,
      unitPrice, gstRate: Number(data.gstRate ?? 12), reorderLevel: Number(data.reorderLevel ?? 50), active: data.active ?? true,
    };
    const medicine = data.id ? await prisma.medicine.update({ where: { id: data.id }, data: values }) : await prisma.medicine.create({ data: values });
    refresh();
    return { success: true, message: `${name} saved`, data: medicine };
  } catch (error) {
    return failed(error, "Failed to save the medicine");
  }
}

export async function receiveStock(medicineId, data = {}) {
  try {
    await guardAction("formulary", "create");
    const quantity = Number(data.quantity);
    const expiry = new Date(data.expiryDate);
    if (!data.batchNumber?.trim()) return { success: false, message: "Enter the batch number" };
    if (!Number.isInteger(quantity) || quantity <= 0) return { success: false, message: "Enter a whole quantity above zero" };
    if (Number.isNaN(expiry.getTime())) return { success: false, message: "Enter the expiry date" };
    if (expiry <= new Date()) return { success: false, message: "This batch has already expired" };
    const batchNumber = data.batchNumber.trim().toUpperCase();
    const existing = await prisma.stockBatch.findUnique({ where: { medicineId_batchNumber: { medicineId, batchNumber } } });
    if (existing) {
      await prisma.stockBatch.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
    } else {
      await prisma.stockBatch.create({ data: { medicineId, batchNumber, expiryDate: expiry, quantity } });
    }
    refresh();
    return { success: true, message: `Received ${quantity} units, batch ${batchNumber}` };
  } catch (error) {
    return failed(error, "Failed to receive stock");
  }
}

export async function getFormulary({ search, activeOnly = false } = {}) {
  try {
    await guardAction("formulary", "read");
    const q = search?.trim();
    const meds = await prisma.medicine.findMany({
      where: {
        ...(activeOnly ? { active: true } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { genericName: { contains: q, mode: "insensitive" } }] } : {}),
      },
      include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
      orderBy: { name: "asc" },
    });
    const now = new Date();
    const soon = new Date(now.getTime() + 90 * 86400000);
    return {
      success: true,
      data: meds.map(({ batches, ...m }) => {
        const usable = batches.filter((b) => b.expiryDate > now);
        const stockOnHand = usable.reduce((s, b) => s + b.quantity, 0);
        return {
          ...m,
          stockOnHand,
          lowStock: stockOnHand < m.reorderLevel,
          nearestExpiry: usable[0]?.expiryDate ?? null,
          expiringSoon: usable.filter((b) => b.expiryDate < soon).reduce((s, b) => s + b.quantity, 0),
          expiredUnits: batches.filter((b) => b.expiryDate <= now).reduce((s, b) => s + b.quantity, 0),
          batches: batches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, expiryDate: b.expiryDate, quantity: b.quantity })),
        };
      }),
    };
  } catch (error) {
    return failed(error, "Failed to load the formulary");
  }
}

// ─── Pharmacy queue ─────────────────────────────────────────────────────────

export async function getPharmacyQueue({ status } = {}) {
  try {
    await guardAction("pharmacy", "read");
    const orders = await prisma.pharmacyOrder.findMany({
      where: status && status !== "active" ? { status } : { status: { in: ["RECEIVED", "PREPARING", "READY"] } },
      include: {
        patient: { select: { id: true, uhid: true, firstName: true, lastName: true, allergies: true } },
        admission: { select: { admissionNumber: true, bed: { select: { bedNumber: true, ward: { select: { name: true } } } } } },
        prescription: { select: { doctor: { select: { user: { select: { firstName: true, lastName: true } } } } } },
        items: { include: { medicine: { select: { id: true, name: true, strength: true, unitPrice: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return { success: true, data: orders };
  } catch (error) {
    return failed(error, "Failed to load the pharmacy queue");
  }
}

async function openOrder(orderId, allowed) {
  const order = await prisma.pharmacyOrder.findUnique({ where: { id: orderId }, include: { items: { include: { medicine: true } }, patient: { select: { uhid: true } } } });
  if (!order) return { error: "Order not found" };
  if (!allowed.includes(order.status)) {
    const words = { RECEIVED: "not started", PREPARING: "being prepared", READY: "ready", DISPENSED: "already handed over", CANCELLED: "cancelled" };
    return { error: `This order is ${words[order.status]}` };
  }
  return { order };
}

export async function startPreparing(orderId) {
  try {
    const { user } = await guardAction("pharmacy", "update");
    const { order, error } = await openOrder(orderId, ["RECEIVED"]);
    if (error) return { success: false, message: error };
    await prisma.pharmacyOrder.update({ where: { id: order.id }, data: { status: "PREPARING", preparedById: user.id } });
    refresh();
    return { success: true, message: `${order.orderNumber} is being prepared` };
  } catch (error) {
    return failed(error, "Failed to update the order");
  }
}

/** Match an unlisted line to a stocked medicine, or substitute (e.g. generic for an out-of-stock brand). */
export async function matchItem(itemId, medicineId, { reason } = {}) {
  try {
    await guardAction("pharmacy", "update");
    const item = await prisma.pharmacyOrderItem.findUnique({ where: { id: itemId }, include: { order: { select: { status: true } }, medicine: true } });
    if (!item) return { success: false, message: "Line not found" };
    if (!["RECEIVED", "PREPARING"].includes(item.order.status)) return { success: false, message: "This order can no longer be changed" };
    const medicine = await prisma.medicine.findFirst({ where: { id: medicineId, active: true } });
    if (!medicine) return { success: false, message: "Choose a medicine from the formulary" };
    const substituting = item.medicineId && item.medicineId !== medicine.id;
    if (substituting && !reason?.trim()) return { success: false, message: "Give a reason for the substitution" };
    await prisma.pharmacyOrderItem.update({
      where: { id: itemId },
      data: {
        medicineId: medicine.id,
        substitutedFrom: item.medicineId === medicine.id ? item.substitutedFrom : item.name,
        substituteReason: reason?.trim() || null,
        name: medicine.name,
      },
    });
    refresh();
    return { success: true, message: `${item.name} → ${medicine.name}` };
  } catch (error) {
    return failed(error, "Failed to update the line");
  }
}

/** Take stock (first expiry first out), price each line and mark the order ready. */
export async function markReady(orderId) {
  try {
    const { user } = await guardAction("pharmacy", "update");
    const { order, error } = await openOrder(orderId, ["RECEIVED", "PREPARING"]);
    if (error) return { success: false, message: error };
    const unmatched = order.items.filter((i) => !i.medicineId);
    if (unmatched.length) return { success: false, message: `Choose a stocked medicine for: ${unmatched.map((i) => i.name).join(", ")}` };

    const plans = [];
    const short = [];
    for (const item of order.items) {
      const batches = await prisma.stockBatch.findMany({ where: { medicineId: item.medicineId } });
      const alloc = allocateFefo(batches, item.quantity);
      if (!alloc.ok) short.push(`${item.medicine.name} (need ${item.quantity}, have ${alloc.available})`);
      else plans.push({ item, allocations: alloc.allocations });
    }
    if (short.length) return { success: false, message: `Not enough stock: ${short.join("; ")}` };

    let total = 0;
    await withTransaction(async (tx) => {
      for (const { item, allocations } of plans) {
        for (const a of allocations) {
          await tx.stockBatch.update({ where: { id: a.batchId, quantity: { gte: a.quantity } }, data: { quantity: { decrement: a.quantity } } });
        }
        total += lineAmount({ quantity: item.quantity, unitPrice: item.medicine.unitPrice, gstRate: item.medicine.gstRate }).total;
        await tx.pharmacyOrderItem.update({ where: { id: item.id }, data: { unitPrice: item.medicine.unitPrice, gstRate: item.medicine.gstRate, allocations } });
      }
      total = Math.round(total * 100) / 100;
      await tx.pharmacyOrder.update({ where: { id: order.id }, data: { status: "READY", readyAt: new Date(), totalAmount: total, preparedById: order.preparedById ?? user.id } });
    });
    refresh();
    const where = order.source === "IPD" ? "ready to issue to the ward" : "ready for pickup";
    return { success: true, message: `${order.orderNumber} is ${where}`, data: { total } };
  } catch (error) {
    if (error.code === "P2025") return { success: false, message: "Stock changed while preparing — please try again" };
    return failed(error, "Failed to prepare the order");
  }
}

/**
 * Hand over. Out-patients: the UHID on the patient's slip / card must match.
 * In-patients: issued to the ward and added to the running bill.
 */
export async function dispense(orderId, { confirmUhid } = {}) {
  try {
    const { user } = await guardAction("pharmacy", "update");
    const { order, error } = await openOrder(orderId, ["READY"]);
    if (error) return { success: false, message: error };

    if (order.source === "OPD") {
      if (String(confirmUhid ?? "").trim().toUpperCase() !== order.patient.uhid) return { success: false, message: "UHID does not match this order" };
    }
    await withTransaction(async (tx) => {
      if (order.source === "IPD" && order.admissionId) {
        for (const item of order.items) {
          await tx.admissionCharge.create({
            data: {
              admissionId: order.admissionId, description: medicineLabel(item.medicine), category: "PHARMACY",
              quantity: item.quantity, unitPrice: item.unitPrice, gstRate: item.gstRate ?? 0, postedById: user.id,
            },
          });
        }
      }
      await tx.pharmacyOrder.update({ where: { id: order.id }, data: { status: "DISPENSED", dispensedAt: new Date(), dispensedById: user.id } });
    });
    refresh();
    if (order.admissionId) revalidatePath(`/admissions/${order.admissionId}`);
    return { success: true, message: order.source === "IPD" ? `${order.orderNumber} issued to the ward and billed` : `${order.orderNumber} handed over` };
  } catch (error) {
    return failed(error, "Failed to hand over");
  }
}
