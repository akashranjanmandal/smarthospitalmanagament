import { describe, it, expect } from "vitest";
import { calculateBillTotal } from "@/lib/billing";

describe("calculateBillTotal", () => {
  it("adds charges and subtracts the discount", () => {
    expect(calculateBillTotal({ consultationFee: 800, additionalCharges: 1500, discount: 100 })).toEqual({
      ok: true,
      consultationFee: 800,
      additionalCharges: 1500,
      discount: 100,
      totalAmount: 2200,
    });
  });

  it("accepts numeric strings from form inputs and defaults optional fields to 0", () => {
    expect(calculateBillTotal({ consultationFee: "500" })).toMatchObject({ ok: true, additionalCharges: 0, discount: 0, totalAmount: 500 });
  });

  it("allows a discount equal to the full amount", () => {
    expect(calculateBillTotal({ consultationFee: 500, discount: 500 })).toMatchObject({ ok: true, totalAmount: 0 });
  });

  it("rejects a discount larger than the bill", () => {
    const r = calculateBillTotal({ consultationFee: 100, discount: 500 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/discount/i);
  });

  it.each([
    [{ consultationFee: -1 }],
    [{ consultationFee: 100, additionalCharges: -50 }],
    [{ consultationFee: 100, discount: -10 }],
    [{ consultationFee: "abc" }],
    [{}],
  ])("rejects invalid amounts %j", (input) => {
    expect(calculateBillTotal(input).ok).toBe(false);
  });
});
