"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { nextSequence } from "@/lib/audit/extension";
import { computeIpdBill, lineAmount, preAuthUsage } from "@/lib/ipd-billing";
import { loadBill } from "@/lib/ipd-bill-data";

const CATEGORIES = ["ROOM", "CONSULTATION", "PROCEDURE", "LAB", "RADIOLOGY", "PHARMACY", "CONSUMABLE", "NURSING", "OTHER"];
const METHODS = ["CASH", "CARD", "UPI"];
const KINDS = ["DEPOSIT", "PAYMENT", "REFUND"];

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const fullName = (u) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : null);
const refresh = (admissionId) => {
  revalidatePath(`/admissions/${admissionId}`);
  revalidatePath("/insurance");
};

// ─── Tariffs ────────────────────────────────────────────────────────────────

export async function getTariffs({ category, activeOnly = false } = {}) {
  try {
    await guardAction("tariffs", "read");
    const tariffs = await prisma.serviceTariff.findMany({
      where: { ...(category && category !== "all" ? { category } : {}), ...(activeOnly ? { active: true } : {}) },
      orderBy: { code: "asc" },
    });
    return { success: true, data: tariffs };
  } catch (error) {
    return failed(error, "Failed to load tariffs");
  }
}

export async function saveTariff(data = {}) {
  try {
    await guardAction("tariffs", data.id ? "update" : "create");
    const code = data.code?.trim().toUpperCase();
    const name = data.name?.trim();
    const price = Number(data.price);
    const gstRate = Number(data.gstRate ?? 0);
    if (!code || !name) return { success: false, message: "Enter a code and a name" };
    if (!CATEGORIES.includes(data.category)) return { success: false, message: "Choose a category" };
    if (!Number.isFinite(price) || price < 0) return { success: false, message: "Price must be zero or more" };
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 28) return { success: false, message: "GST must be between 0 and 28%" };

    const clash = await prisma.serviceTariff.findFirst({ where: { code, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
    if (clash) return { success: false, message: `Tariff code ${code} already exists` };

    const values = { code, name, category: data.category, price, gstRate, active: data.active ?? true };
    const tariff = data.id
      ? await prisma.serviceTariff.update({ where: { id: data.id }, data: values })
      : await prisma.serviceTariff.create({ data: values });
    revalidatePath("/admin/tariffs");
    return { success: true, message: "Tariff saved", data: tariff };
  } catch (error) {
    return failed(error, "Failed to save tariff");
  }
}

// ─── Bill ───────────────────────────────────────────────────────────────────


export async function getAdmissionBill(admissionId) {
  try {
    const { role } = await guardAction("billing", "read");
    if (role === "PATIENT") return { success: false, message: "Admission not found" };
    const bill = await loadBill(admissionId);
    if (!bill) return { success: false, message: "Admission not found" };
    const { admission: a, totals, insured, approved } = bill;

    const staffIds = [...new Set([...a.charges.flatMap((c) => [c.postedById, c.cancelledById]), ...a.payments.map((p) => p.receivedById)].filter(Boolean))];
    const staff = new Map((await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, fullName(u)]));

    return {
      success: true,
      data: {
        admissionId: a.id,
        status: a.status,
        bedType: a.bed.bedType,
        lines: a.charges.map((c) => ({
          id: c.id, description: c.description, category: c.category, quantity: c.quantity, unitPrice: c.unitPrice, gstRate: c.gstRate,
          amount: lineAmount(c).total, postedAt: c.postedAt, postedBy: staff.get(c.postedById) ?? null,
          cancelled: Boolean(c.cancelledAt), cancelReason: c.cancelReason, cancelledBy: staff.get(c.cancelledById) ?? null,
        })),
        payments: a.payments.map((p) => ({ ...p, receivedBy: staff.get(p.receivedById) ?? null })),
        totals,
        finalized: a.billFinalizedAt ? { billNumber: a.billNumber, finalizedAt: a.billFinalizedAt, amount: a.finalBillAmount } : null,
        insurance: {
          insured,
          payerType: a.payerType,
          insurerName: a.insurerName, tpaName: a.tpaName, policyNumber: a.policyNumber, memberId: a.memberId,
          policyValidTill: a.policyValidTill, sumInsured: a.sumInsured,
          approvedAmount: approved.amount,
          finalApproved: approved.final,
          usage: preAuthUsage(totals.total, approved.amount),
          preAuths: a.preAuths,
          claim: a.claim,
        },
      },
    };
  } catch (error) {
    return failed(error, "Failed to load the bill");
  }
}

async function openForCharges(admissionId) {
  const a = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, status: true, billFinalizedAt: true } });
  if (!a) return "Admission not found";
  if (a.billFinalizedAt) return "The final bill has been prepared; no more charges can be added";
  if (a.status !== "ADMITTED") return "This patient has been discharged";
  return null;
}

export async function postCharge(admissionId, data = {}) {
  try {
    const { user } = await guardAction("billing", "create");
    const problem = await openForCharges(admissionId);
    if (problem) return { success: false, message: problem };

    const quantity = Number(data.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) return { success: false, message: "Quantity must be more than zero" };

    let line;
    if (data.tariffId) {
      const t = await prisma.serviceTariff.findFirst({ where: { id: data.tariffId, active: true } });
      if (!t) return { success: false, message: "Choose an item from the price list" };
      line = { tariffId: t.id, description: t.name, category: t.category, unitPrice: t.price, gstRate: t.gstRate };
    } else {
      const description = data.description?.trim();
      const unitPrice = Number(data.unitPrice);
      if (!description) return { success: false, message: "Describe the charge" };
      if (!CATEGORIES.includes(data.category)) return { success: false, message: "Choose a category" };
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return { success: false, message: "Enter a valid price" };
      line = { description, category: data.category, unitPrice, gstRate: Number(data.gstRate ?? 0) };
    }

    const charge = await prisma.admissionCharge.create({ data: { admissionId, ...line, quantity, postedById: user.id } });
    refresh(admissionId);
    return { success: true, message: `${charge.description} added to the bill`, data: { id: charge.id } };
  } catch (error) {
    return failed(error, "Failed to add the charge");
  }
}

export async function cancelCharge(chargeId, reason) {
  try {
    const { user } = await guardAction("billing", "update");
    const charge = await prisma.admissionCharge.findUnique({ where: { id: chargeId }, select: { id: true, admissionId: true, cancelledAt: true } });
    if (!charge) return { success: false, message: "Charge not found" };
    if (charge.cancelledAt) return { success: false, message: "This charge is already cancelled" };
    if (!reason?.trim()) return { success: false, message: "Give a reason for cancelling this charge" };
    const fin = await prisma.admission.findUnique({ where: { id: charge.admissionId }, select: { billFinalizedAt: true } });
    if (fin.billFinalizedAt) return { success: false, message: "The final bill has been prepared; charges can no longer change" };

    await prisma.admissionCharge.update({ where: { id: chargeId }, data: { cancelledAt: new Date(), cancelledById: user.id, cancelReason: reason.trim() } });
    refresh(charge.admissionId);
    return { success: true, message: "Charge cancelled" };
  } catch (error) {
    return failed(error, "Failed to cancel the charge");
  }
}

export async function recordPayment(admissionId, data = {}) {
  try {
    const { user } = await guardAction("billing", "create");
    const amount = Number(data.amount);
    if (!KINDS.includes(data.kind)) return { success: false, message: "Choose deposit, payment or refund" };
    if (!METHODS.includes(data.method)) return { success: false, message: "Choose cash, card or UPI" };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: "Enter an amount greater than zero" };

    const bill = await loadBill(admissionId);
    if (!bill) return { success: false, message: "Admission not found" };
    if (data.kind === "REFUND" && amount > bill.totals.received) {
      return { success: false, message: `Cannot refund more than ₹${bill.totals.received} received` };
    }

    const year = new Date().getFullYear();
    const receiptNumber = `RCP-${year}-${String(await nextSequence(prisma, `receipt-${year}`)).padStart(6, "0")}`;
    const payment = await prisma.admissionPayment.create({
      data: { admissionId, receiptNumber, kind: data.kind, amount, method: data.method, reference: data.reference?.trim() || null, receivedById: user.id },
    });
    refresh(admissionId);
    const verb = { DEPOSIT: "Deposit received", PAYMENT: "Payment received", REFUND: "Refund paid" }[data.kind];
    return { success: true, message: `${verb} — receipt ${receiptNumber}`, data: { id: payment.id, receiptNumber } };
  } catch (error) {
    return failed(error, "Failed to record the payment");
  }
}

/** Freeze the bill: room days and rate, discount and total. No more charges after this. */
export async function finalizeBill(admissionId, { discount = 0 } = {}) {
  try {
    await guardAction("billing", "update");
    const bill = await loadBill(admissionId);
    if (!bill) return { success: false, message: "Admission not found" };
    if (bill.admission.billFinalizedAt) return { success: false, message: "The final bill has already been prepared" };
    const d = Number(discount) || 0;
    if (d < 0) return { success: false, message: "Discount cannot be negative" };

    let totals;
    try {
      totals = computeIpdBill({ roomDays: bill.totals.room.days, roomRate: bill.totals.room.rate, charges: bill.admission.charges, payments: bill.admission.payments, discount: d });
    } catch (e) {
      return { success: false, message: e.message };
    }
    const year = new Date().getFullYear();
    const billNumber = `BL-${year}-${String(await nextSequence(prisma, `bill-${year}`)).padStart(6, "0")}`;
    await prisma.admission.update({
      where: { id: admissionId },
      data: { billNumber, billFinalizedAt: new Date(), billRoomDays: totals.room.days, billRoomRate: totals.room.rate, billDiscount: d, finalBillAmount: totals.total },
    });
    refresh(admissionId);
    return { success: true, message: `Final bill ${billNumber} prepared`, data: { billNumber, total: totals.total } };
  } catch (error) {
    return failed(error, "Failed to prepare the final bill");
  }
}
