import { describe, it, expect } from "vitest";
import { dosesPerDay, durationDays, quantityFor, doseTimes } from "@/lib/pharmacy/dosing";
import { checkPrescription } from "@/lib/pharmacy/safety";
import { allocateFefo } from "@/lib/pharmacy/stock";

describe("dosing", () => {
  it("understands standard abbreviations and Indian 1-0-1 notation", () => {
    expect([dosesPerDay("OD"), dosesPerDay("BD"), dosesPerDay("TDS"), dosesPerDay("QID"), dosesPerDay("HS"), dosesPerDay("SOS")]).toEqual([1, 2, 3, 4, 1, 0]);
    expect([dosesPerDay("1-0-1"), dosesPerDay("1-1-1"), dosesPerDay("0-0-1"), dosesPerDay("1/2-0-1/2")]).toEqual([2, 3, 1, 2]);
    expect(quantityFor({ frequency: "1/2-0-1/2", duration: "10 days", perDose: 0.5 })).toBe(10);
    expect([dosesPerDay("Three times a day"), dosesPerDay("twice daily"), dosesPerDay("once a day at night")]).toEqual([3, 2, 1]);
  });

  it("reads durations in days and weeks", () => {
    expect([durationDays("5 days"), durationDays("2 weeks"), durationDays("1 month"), durationDays("10"), durationDays("")]).toEqual([5, 14, 30, 10, null]);
  });

  it("works out how many units to dispense", () => {
    expect(quantityFor({ frequency: "1-0-1", duration: "5 days" })).toBe(10);
    expect(quantityFor({ frequency: "TDS", duration: "1 week" })).toBe(21);
    expect(quantityFor({ frequency: "SOS", duration: "5 days" })).toBe(5);
    expect(quantityFor({ frequency: "BD", duration: "" })).toBe(2);
  });

  it("gives ward dose times for each frequency", () => {
    expect(doseTimes("BD")).toEqual(["09:00", "21:00"]);
    expect(doseTimes("TDS")).toEqual(["08:00", "14:00", "20:00"]);
    expect(doseTimes("SOS")).toEqual([]);
  });
});

describe("prescription safety", () => {
  const amox = { name: "Amoxicillin 500 mg", genericName: "Amoxicillin" };
  it("flags drugs the patient is allergic to, including by drug family", () => {
    expect(checkPrescription({ items: [amox], allergies: "Penicillin" })).toEqual([
      { type: "ALLERGY", severity: "high", message: "Amoxicillin 500 mg — patient is allergic to Penicillin" },
    ]);
    expect(checkPrescription({ items: [{ name: "Brufen 400", genericName: "Ibuprofen" }], allergies: "nsaids, sulfa" })[0].type).toBe("ALLERGY");
  });

  it("flags known dangerous combinations, including with medicines already running", () => {
    const w = checkPrescription({ items: [{ name: "Ecosprin 75", genericName: "Aspirin" }], current: [{ name: "Warfarin 5 mg", genericName: "Warfarin" }] });
    expect(w).toEqual([{ type: "INTERACTION", severity: "high", message: "Aspirin + Warfarin — higher bleeding risk" }]);
  });

  it("flags the same medicine prescribed twice", () => {
    const w = checkPrescription({ items: [{ name: "Dolo 650", genericName: "Paracetamol" }, { name: "Crocin 500", genericName: "Paracetamol" }] });
    expect(w).toEqual([{ type: "DUPLICATE", severity: "medium", message: "Paracetamol is prescribed more than once (Dolo 650, Crocin 500)" }]);
  });

  it("is quiet when nothing is wrong", () => {
    expect(checkPrescription({ items: [amox], allergies: "", current: [] })).toEqual([]);
  });
});

describe("stock allocation (first expiry, first out)", () => {
  const today = new Date("2026-10-25");
  const batches = [
    { id: "late", batchNumber: "B3", expiryDate: new Date("2027-06-30"), quantity: 100 },
    { id: "expired", batchNumber: "B1", expiryDate: new Date("2026-09-30"), quantity: 50 },
    { id: "soon", batchNumber: "B2", expiryDate: new Date("2026-12-31"), quantity: 8 },
  ];
  it("uses the batch expiring soonest and never an expired one", () => {
    expect(allocateFefo(batches, 10, today)).toEqual({ ok: true, allocations: [{ batchId: "soon", batchNumber: "B2", quantity: 8 }, { batchId: "late", batchNumber: "B3", quantity: 2 }] });
  });
  it("reports a shortage", () => {
    expect(allocateFefo(batches, 200, today)).toEqual({ ok: false, available: 108 });
  });
});
