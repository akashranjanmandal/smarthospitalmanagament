function toAmount(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validates bill amounts and computes the total.
 * Returns { ok: true, consultationFee, additionalCharges, discount, totalAmount } or { ok: false, message }.
 */
export function calculateBillTotal({ consultationFee, additionalCharges, discount } = {}) {
  const fee = toAmount(consultationFee, NaN);
  const extra = toAmount(additionalCharges, 0);
  const off = toAmount(discount, 0);

  if (![fee, extra, off].every(Number.isFinite)) {
    return { ok: false, message: "Enter valid amounts for the consultation fee, charges and discount" };
  }
  if (fee < 0 || extra < 0 || off < 0) {
    return { ok: false, message: "Amounts cannot be negative" };
  }
  if (off > fee + extra) {
    return { ok: false, message: "Discount cannot be more than the bill amount" };
  }

  return { ok: true, consultationFee: fee, additionalCharges: extra, discount: off, totalAmount: fee + extra - off };
}
