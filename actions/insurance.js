"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { nextSequence } from "@/lib/audit/extension";
import { loadBill } from "@/lib/ipd-bill-data";
import { preAuthUsage } from "@/lib/ipd-billing";
import { fmtDate } from "@/lib/format";

const PAYERS = ["SELF", "INSURANCE", "CORPORATE", "GOVERNMENT_SCHEME"];
const HOUR = 3600000;

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "Only the insurance desk can do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const refresh = (admissionId) => {
  revalidatePath(`/admissions/${admissionId}`);
  revalidatePath("/insurance");
};
const nextNumber = async (prefix, name) => {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(await nextSequence(prisma, `${name}-${year}`)).padStart(6, "0")}`;
};

/** Who pays for this stay. Front office captures it at admission; the desk can correct it. */
export async function setPayer(admissionId, data = {}) {
  try {
    await guardAction("insurance", "update");
    if (!PAYERS.includes(data.payerType)) return { success: false, message: "Choose who is paying" };
    const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, claim: { select: { id: true } } } });
    if (!admission) return { success: false, message: "Admission not found" };
    if (admission.claim) return { success: false, message: "A claim has been filed; payer details can no longer change" };

    if (data.payerType === "SELF") {
      await prisma.admission.update({
        where: { id: admissionId },
        data: { payerType: "SELF", insurerName: null, tpaName: null, policyNumber: null, memberId: null, policyValidTill: null, sumInsured: null },
      });
    } else {
      const insurerName = data.insurerName?.trim();
      const policyNumber = data.policyNumber?.trim();
      if (!insurerName) return { success: false, message: "Enter the insurer / scheme name" };
      if (!policyNumber) return { success: false, message: "Enter the policy / card number" };
      const validTill = data.policyValidTill ? new Date(data.policyValidTill) : null;
      if (validTill && validTill < new Date()) return { success: false, message: `This policy expired on ${fmtDate(validTill)}` };
      const sumInsured = data.sumInsured === "" || data.sumInsured == null ? null : Number(data.sumInsured);
      if (sumInsured != null && (!Number.isFinite(sumInsured) || sumInsured < 0)) return { success: false, message: "Enter a valid sum insured" };
      await prisma.admission.update({
        where: { id: admissionId },
        data: {
          payerType: data.payerType, insurerName, policyNumber, sumInsured, policyValidTill: validTill,
          tpaName: data.tpaName?.trim() || null, memberId: data.memberId?.trim() || null,
        },
      });
    }
    refresh(admissionId);
    return { success: true, message: "Payer details saved" };
  } catch (error) {
    return failed(error, "Failed to save payer details");
  }
}

export async function requestPreAuth(admissionId, data = {}) {
  try {
    const { user } = await guardAction("insurance", "create");
    const bill = await loadBill(admissionId);
    if (!bill) return { success: false, message: "Admission not found" };
    const { admission: a } = bill;
    if (a.payerType === "SELF") return { success: false, message: "This patient is paying themselves" };
    if (a.status !== "ADMITTED") return { success: false, message: "Pre-authorisation is only for patients still admitted" };

    const open = a.preAuths.filter((p) => p.status !== "REJECTED");
    const has = (kind, status) => open.some((p) => p.kind === kind && (!status || p.status === status));
    let requestedAmount = Number(data.requestedAmount);

    if (data.kind === "INITIAL") {
      if (has("INITIAL")) return { success: false, message: "An initial pre-authorisation already exists" };
    } else if (data.kind === "ENHANCEMENT") {
      if (!has("INITIAL", "APPROVED")) return { success: false, message: "Get the initial pre-authorisation approved first" };
    } else if (data.kind === "FINAL") {
      if (!a.billFinalizedAt) return { success: false, message: "Prepare the final bill before requesting final approval" };
      if (has("FINAL")) return { success: false, message: "Final approval has already been requested" };
      if (!data.requestedAmount) requestedAmount = a.finalBillAmount;
    } else {
      return { success: false, message: "Choose initial, enhancement or final" };
    }
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return { success: false, message: "Enter the amount to request" };

    const preAuth = await prisma.preAuth.create({
      data: { admissionId, kind: data.kind, requestedAmount, remarks: data.remarks?.trim() || null, requestedById: user.id },
    });
    refresh(admissionId);
    const label = { INITIAL: "Pre-authorisation", ENHANCEMENT: "Enhancement", FINAL: "Final approval" }[data.kind];
    return { success: true, message: `${label} request recorded for ₹${requestedAmount}`, data: preAuth };
  } catch (error) {
    return failed(error, "Failed to record the request");
  }
}

/** Record the insurer's reply: approved (with amount), query (needs more documents) or rejected. */
export async function respondPreAuth(preAuthId, data = {}) {
  try {
    const { user } = await guardAction("insurance", "create");
    const p = await prisma.preAuth.findUnique({ where: { id: preAuthId } });
    if (!p) return { success: false, message: "Request not found" };
    if (p.status === "APPROVED" || p.status === "REJECTED") return { success: false, message: "The insurer has already decided this request" };
    if (!["APPROVED", "QUERY", "REJECTED"].includes(data.status)) return { success: false, message: "Choose approved, query or rejected" };

    let approvedAmount = null;
    if (data.status === "APPROVED") {
      approvedAmount = Number(data.approvedAmount);
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) return { success: false, message: "Enter the approved amount" };
      if (approvedAmount > p.requestedAmount) return { success: false, message: `Approved amount cannot be more than requested (₹${p.requestedAmount})` };
    }
    if (data.status !== "APPROVED" && !data.remarks?.trim()) return { success: false, message: "Note the insurer's query or reason" };

    await prisma.preAuth.update({
      where: { id: p.id },
      data: {
        status: data.status, approvedAmount,
        referenceNumber: data.referenceNumber?.trim() || p.referenceNumber,
        responseRemarks: data.remarks?.trim() || null,
        respondedById: user.id, respondedAt: new Date(),
      },
    });
    refresh(p.admissionId);
    return { success: true, message: data.status === "APPROVED" ? `Approved for ₹${approvedAmount}` : data.status === "QUERY" ? "Query recorded" : "Rejection recorded" };
  } catch (error) {
    return failed(error, "Failed to record the insurer's reply");
  }
}

export async function submitClaim(admissionId, data = {}) {
  try {
    const { user } = await guardAction("insurance", "create");
    const bill = await loadBill(admissionId);
    if (!bill) return { success: false, message: "Admission not found" };
    const { admission: a, approved } = bill;
    if (a.payerType === "SELF") return { success: false, message: "This patient is paying themselves" };
    if (a.status !== "DISCHARGED") return { success: false, message: "Discharge the patient before filing the claim" };
    if (a.claim) return { success: false, message: "A claim has already been filed for this stay" };
    if (!approved.final) return { success: false, message: "Final approval from the insurer is needed before filing" };

    const claimedAmount = data.claimedAmount ? Number(data.claimedAmount) : approved.amount;
    if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) return { success: false, message: "Enter the claim amount" };
    const claim = await prisma.insuranceClaim.create({
      data: { admissionId, claimNumber: await nextNumber("CLM", "claim"), claimedAmount, remarks: data.remarks?.trim() || null, submittedById: user.id },
    });
    refresh(admissionId);
    return { success: true, message: `Claim ${claim.claimNumber} filed for ₹${claimedAmount}`, data: claim };
  } catch (error) {
    return failed(error, "Failed to file the claim");
  }
}

export async function settleClaim(claimId, data = {}) {
  try {
    await guardAction("insurance", "create");
    const claim = await prisma.insuranceClaim.findUnique({ where: { id: claimId } });
    if (!claim) return { success: false, message: "Claim not found" };
    if (claim.status === "SETTLED" || claim.status === "REJECTED") return { success: false, message: "This claim is already closed" };
    if (!["SETTLED", "QUERY", "REJECTED"].includes(data.status)) return { success: false, message: "Choose settled, query or rejected" };

    const update = { status: data.status, remarks: data.remarks?.trim() || claim.remarks };
    if (data.status === "SETTLED") {
      const settledAmount = Number(data.settledAmount);
      if (!Number.isFinite(settledAmount) || settledAmount < 0 || settledAmount > claim.claimedAmount) {
        return { success: false, message: `Settled amount must be between ₹0 and ₹${claim.claimedAmount}` };
      }
      const deductions = (Array.isArray(data.deductions) ? data.deductions : [])
        .map((d) => ({ reason: d?.reason?.trim() || "", amount: Number(d?.amount) || 0 }))
        .filter((d) => d.reason && d.amount > 0);
      const gap = Math.round((claim.claimedAmount - settledAmount) * 100) / 100;
      const explained = Math.round(deductions.reduce((s, d) => s + d.amount, 0) * 100) / 100;
      if (gap > 0 && explained !== gap) return { success: false, message: `Record the reasons for the ₹${gap} deduction` };
      Object.assign(update, { settledAmount, deductions, utrNumber: data.utrNumber?.trim() || null, settledAt: new Date() });
    } else if (!data.remarks?.trim()) {
      return { success: false, message: "Note the insurer's query or reason" };
    }

    await prisma.insuranceClaim.update({ where: { id: claimId }, data: update });
    refresh(claim.admissionId);
    return { success: true, message: data.status === "SETTLED" ? "Claim settled" : data.status === "QUERY" ? "Query recorded" : "Claim rejection recorded" };
  } catch (error) {
    return failed(error, "Failed to update the claim");
  }
}

/** The desk's day: requests waiting on insurers, stays nearing their approved limit, discharges waiting, open claims. */
export async function getInsuranceWorklist() {
  try {
    await guardAction("insurance", "create");
    const now = Date.now();
    const insured = await prisma.admission.findMany({
      where: { payerType: { not: "SELF" }, OR: [{ status: "ADMITTED" }, { claim: { is: null } }, { claim: { status: { in: ["SUBMITTED", "QUERY"] } } }] },
      select: { id: true },
      orderBy: { admittedAt: "desc" },
      take: 300,
    });

    const rows = [];
    for (const { id } of insured) {
      const bill = await loadBill(id);
      const a = bill.admission;
      rows.push({
        admissionId: a.id,
        admissionNumber: a.admissionNumber,
        status: a.status,
        patientName: null,
        insurer: [a.insurerName, a.tpaName].filter(Boolean).join(" / "),
        bill: bill.totals.total,
        approvedAmount: bill.approved.amount,
        finalApproved: bill.approved.final,
        billFinalized: Boolean(a.billFinalizedAt),
        usage: preAuthUsage(bill.totals.total, bill.approved.amount),
        preAuths: a.preAuths,
        claim: a.claim,
      });
    }
    const names = new Map(
      (await prisma.admission.findMany({ where: { id: { in: rows.map((r) => r.admissionId) } }, select: { id: true, patient: { select: { firstName: true, lastName: true, uhid: true } } } }))
        .map((a) => [a.id, a.patient])
    );
    for (const r of rows) {
      const p = names.get(r.admissionId);
      r.patientName = `${p.firstName} ${p.lastName}`.trim();
      r.uhid = p.uhid;
    }

    const awaitingInsurer = rows.flatMap((r) =>
      r.preAuths.filter((p) => p.status === "SUBMITTED" || p.status === "QUERY").map((p) => ({ ...r, preAuth: p, hoursWaiting: Math.floor((now - new Date(p.createdAt)) / HOUR) }))
    );
    const admitted = rows.filter((r) => r.status === "ADMITTED");
    const claims = await prisma.insuranceClaim.findMany({ select: { claimedAmount: true, settledAmount: true, status: true } });
    const settled = claims.filter((c) => c.status === "SETTLED");

    return {
      success: true,
      data: {
        awaitingInsurer,
        needsPreAuth: admitted.filter((r) => !r.preAuths.some((p) => p.kind === "INITIAL" && p.status !== "REJECTED")),
        nearLimit: admitted.filter((r) => r.usage.level === "warn" || r.usage.level === "over"),
        awaitingFinal: admitted.filter((r) => r.billFinalized && !r.finalApproved),
        readyToClaim: rows.filter((r) => r.status === "DISCHARGED" && r.finalApproved && !r.claim),
        openClaims: rows
          .filter((r) => r.claim && (r.claim.status === "SUBMITTED" || r.claim.status === "QUERY"))
          .map((r) => ({ ...r, daysOpen: Math.floor((now - new Date(r.claim.submittedAt)) / (24 * HOUR)) })),
        stats: {
          claimed: claims.reduce((s, c) => s + c.claimedAmount, 0),
          settled: settled.reduce((s, c) => s + (c.settledAmount ?? 0), 0),
          deducted: settled.reduce((s, c) => s + (c.claimedAmount - (c.settledAmount ?? 0)), 0),
        },
      },
    };
  } catch (error) {
    return failed(error, "Failed to load the worklist");
  }
}
