// In-patient bill arithmetic. Amounts are rupees, rounded to paise.
const round = (n) => Math.round(n * 100) / 100;

export function lineAmount({ quantity = 1, unitPrice = 0, gstRate = 0 }) {
  const net = round(quantity * unitPrice);
  const gst = round((net * gstRate) / 100);
  return { net, gst, total: round(net + gst) };
}

/**
 * @param roomDays/roomRate  bed charges (days × daily tariff for the bed type)
 * @param charges            posted lines; cancelled ones are ignored
 * @param payments           DEPOSIT / PAYMENT add, REFUND subtracts
 * @param insured            when true the insurer pays up to approvedAmount
 */
export function computeIpdBill({ roomDays = 0, roomRate = 0, charges = [], payments = [], discount = 0, insured = false, approvedAmount = 0 }) {
  const room = { days: roomDays, rate: roomRate, total: round(roomDays * roomRate) };
  const byCategory = {};
  if (room.total) byCategory.ROOM = room.total;

  let subtotal = room.total;
  let gst = 0;
  for (const c of charges) {
    if (c.cancelledAt) continue;
    const a = lineAmount(c);
    subtotal += a.net;
    gst += a.gst;
    byCategory[c.category] = round((byCategory[c.category] ?? 0) + a.total);
  }
  subtotal = round(subtotal);
  gst = round(gst);
  if (discount > subtotal + gst) throw new Error("Discount cannot be more than the bill");
  const total = round(subtotal + gst - discount);

  const received = round(payments.reduce((sum, p) => sum + (p.kind === "REFUND" ? -p.amount : p.amount), 0));
  const insurerPays = insured ? round(Math.min(approvedAmount || 0, total)) : 0;
  const patientShare = round(total - insurerPays);

  return { room, byCategory, subtotal, gst, discount: round(discount), total, received, insurerPays, patientShare, balanceDue: round(patientShare - received) };
}

/** How much of the insurer's approved amount the running bill has used. */
export function preAuthUsage(billTotal, approvedAmount) {
  if (!approvedAmount) return { percent: null, level: "none" };
  const percent = Math.round((billTotal / approvedAmount) * 100);
  return { percent, level: percent > 100 ? "over" : percent >= 80 ? "warn" : "ok" };
}
