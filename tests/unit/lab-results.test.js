import { describe, it, expect } from "vitest";
import { flagValue, evaluateResults, formatRange } from "@/lib/lab/results";

const platelets = { name: "Platelets", unit: "/µL", low: 150000, high: 450000, criticalLow: 20000, criticalHigh: 1000000 };
const ns1 = { name: "NS1 antigen", type: "choice", options: ["Negative", "Positive"], abnormal: ["Positive"] };

describe("flagValue", () => {
  it("marks normal, high, low and critical numeric results", () => {
    expect(flagValue(platelets, 210000)).toBe("N");
    expect(flagValue(platelets, 98000)).toBe("L");
    expect(flagValue(platelets, 15000)).toBe("LL");
    expect(flagValue(platelets, 600000)).toBe("H");
    expect(flagValue(platelets, 1200000)).toBe("HH");
  });

  it("marks qualitative results from their abnormal options", () => {
    expect(flagValue(ns1, "Negative")).toBe("N");
    expect(flagValue(ns1, "Positive")).toBe("A");
  });
});

describe("evaluateResults", () => {
  it("checks every parameter, needs a value for each, and reports critical ones", () => {
    const hb = { name: "Haemoglobin", unit: "g/dL", low: 12, high: 16, criticalLow: 7 };
    expect(evaluateResults([hb, platelets], { Haemoglobin: "6.5" })).toEqual({ ok: false, message: "Enter a result for Platelets" });
    expect(evaluateResults([hb, platelets], { Haemoglobin: "abc", Platelets: "1" })).toEqual({ ok: false, message: "Haemoglobin must be a number" });

    const res = evaluateResults([hb, platelets], { Haemoglobin: "6.5", Platelets: "98000" });
    expect(res).toEqual({
      ok: true,
      critical: true,
      abnormal: true,
      results: [
        { name: "Haemoglobin", value: 6.5, unit: "g/dL", range: "12 – 16", flag: "LL" },
        { name: "Platelets", value: 98000, unit: "/µL", range: "150000 – 450000", flag: "L" },
      ],
    });
  });

  it("accepts only the listed options for qualitative tests", () => {
    expect(evaluateResults([ns1], { "NS1 antigen": "Maybe" })).toEqual({ ok: false, message: "NS1 antigen must be one of: Negative, Positive" });
    expect(evaluateResults([ns1], { "NS1 antigen": "Positive" })).toMatchObject({ ok: true, abnormal: true, critical: false });
  });
});

describe("formatRange", () => {
  it("shows the normal range readably", () => {
    expect(formatRange({ low: 0.6, high: 1.3 })).toBe("0.6 – 1.3");
    expect(formatRange({ high: 200 })).toBe("< 200");
    expect(formatRange({ type: "choice", options: ["Negative", "Positive"], abnormal: ["Positive"] })).toBe("Negative");
  });
});
