import { describe, it, expect } from "vitest";
import { computeIpdBill, lineAmount, preAuthUsage } from "@/lib/ipd-billing";

describe("lineAmount", () => {
  it("multiplies quantity by price and adds GST", () => {
    expect(lineAmount({ quantity: 2, unitPrice: 350, gstRate: 0 })).toEqual({ net: 700, gst: 0, total: 700 });
    expect(lineAmount({ quantity: 3, unitPrice: 100, gstRate: 12 })).toEqual({ net: 300, gst: 36, total: 336 });
  });
});

describe("computeIpdBill", () => {
  const base = {
    roomDays: 3,
    roomRate: 1500,
    charges: [
      { category: "CONSULTATION", quantity: 3, unitPrice: 800, gstRate: 0 },
      { category: "PHARMACY", quantity: 10, unitPrice: 50, gstRate: 12 },
      { category: "LAB", quantity: 1, unitPrice: 350, gstRate: 0, cancelledAt: new Date() },
    ],
    payments: [
      { kind: "DEPOSIT", amount: 5000 },
      { kind: "PAYMENT", amount: 1000 },
    ],
  };

  it("adds room days, live charges and GST, ignoring cancelled lines", () => {
    const bill = computeIpdBill(base);
    expect(bill.room).toEqual({ days: 3, rate: 1500, total: 4500 });
    expect(bill.byCategory).toEqual({ ROOM: 4500, CONSULTATION: 2400, PHARMACY: 560 });
    expect(bill).toMatchObject({ subtotal: 7400, gst: 60, discount: 0, total: 7460 });
  });

  it("works out what the self-paying patient still owes", () => {
    expect(computeIpdBill(base)).toMatchObject({ received: 6000, insurerPays: 0, patientShare: 7460, balanceDue: 1460 });
  });

  it("splits the bill between insurer (up to the approved amount) and patient", () => {
    const bill = computeIpdBill({ ...base, insured: true, approvedAmount: 6000 });
    expect(bill).toMatchObject({ insurerPays: 6000, patientShare: 1460, balanceDue: -4540 });
  });

  it("applies a discount and never lets it exceed the bill", () => {
    expect(computeIpdBill({ ...base, discount: 460 }).total).toBe(7000);
    expect(() => computeIpdBill({ ...base, discount: 99999 })).toThrow("Discount cannot be more than the bill");
  });

  it("counts refunds against money received", () => {
    const bill = computeIpdBill({ ...base, payments: [...base.payments, { kind: "REFUND", amount: 500 }] });
    expect(bill.received).toBe(5500);
  });
});

describe("preAuthUsage", () => {
  it("warns at 80% of the approved amount and flags when exceeded", () => {
    expect(preAuthUsage(7000, 10000)).toEqual({ percent: 70, level: "ok" });
    expect(preAuthUsage(8200, 10000)).toEqual({ percent: 82, level: "warn" });
    expect(preAuthUsage(10500, 10000)).toEqual({ percent: 105, level: "over" });
    expect(preAuthUsage(5000, 0)).toEqual({ percent: null, level: "none" });
  });
});
