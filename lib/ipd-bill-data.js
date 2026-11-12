import { prisma } from "@/lib/prisma";
import { computeIpdBill } from "@/lib/ipd-billing";
import { lengthOfStayDays } from "@/lib/identifiers";

async function roomRateFor(bedType) {
  const t = await prisma.serviceTariff.findUnique({ where: { code: `BED-${bedType}` }, select: { price: true, active: true } });
  return t?.active ? t.price : 0;
}

/** Approved insurer amount: the final approval if there is one, otherwise initial + enhancements. */
export function approvedFrom(preAuths) {
  const approved = preAuths.filter((p) => p.status === "APPROVED");
  const final = approved.find((p) => p.kind === "FINAL");
  if (final) return { amount: final.approvedAmount, final: true };
  return { amount: approved.reduce((s, p) => s + (p.approvedAmount ?? 0), 0), final: false };
}

/** Everything needed to show or check an in-patient bill (used by billing, insurance and discharge). */
export async function loadBill(admissionId) {
  const a = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: {
      bed: { select: { bedNumber: true, bedType: true } },
      charges: { orderBy: { postedAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      preAuths: { orderBy: { createdAt: "asc" } },
      claim: true,
      patient: { select: { userId: true } },
    },
  });
  if (!a) return null;
  const finalized = Boolean(a.billFinalizedAt);
  const roomDays = finalized ? a.billRoomDays : lengthOfStayDays(a.admittedAt, a.dischargedAt ?? new Date());
  const roomRate = finalized ? a.billRoomRate : await roomRateFor(a.bed.bedType);
  const insured = a.payerType !== "SELF";
  const approved = approvedFrom(a.preAuths);
  const totals = computeIpdBill({
    roomDays,
    roomRate,
    charges: a.charges,
    payments: a.payments,
    discount: a.billDiscount ?? 0,
    insured,
    approvedAmount: approved.amount,
  });
  return { admission: a, totals, insured, approved };
}
