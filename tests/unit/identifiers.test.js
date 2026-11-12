import { describe, it, expect } from "vitest";
import { formatUhid, formatAdmissionNumber, lengthOfStayDays } from "@/lib/identifiers";

describe("hospital identifiers", () => {
  it("formats a chain-wide UHID", () => {
    expect(formatUhid(42)).toBe("SHDS-00000042");
    expect(formatUhid(12345678, "NH")).toBe("NH-12345678");
  });

  it("formats an in-patient admission number by year", () => {
    expect(formatAdmissionNumber(2026, 7)).toBe("IP-2026-000007");
  });

  it("counts the hospital day by Indian calendar date (admission day is day 1)", () => {
    const admitted = new Date("2026-10-20T22:00:00+05:30");
    expect(lengthOfStayDays(admitted, new Date("2026-10-20T23:30:00+05:30"))).toBe(1);
    expect(lengthOfStayDays(admitted, new Date("2026-10-21T00:30:00+05:30"))).toBe(2);
    expect(lengthOfStayDays(admitted, new Date("2026-10-24T09:00:00+05:30"))).toBe(5);
  });
});
