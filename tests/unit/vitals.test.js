import { describe, it, expect } from "vitest";
import { validateVitals, vitalFlags } from "@/lib/clinical/vitals";

describe("validateVitals", () => {
  it("accepts a normal set of readings and converts them to numbers", () => {
    const res = validateVitals({ temperature: "98.6", pulse: "72", systolic: "120", diastolic: "80", respiratoryRate: "16", spo2: "98" });
    expect(res).toEqual({ ok: true, values: { temperature: 98.6, pulse: 72, systolic: 120, diastolic: 80, respiratoryRate: 16, spo2: 98 } });
  });

  it("ignores blank fields", () => {
    expect(validateVitals({ pulse: "88", spo2: "" })).toEqual({ ok: true, values: { pulse: 88 } });
  });

  it("needs at least one reading", () => {
    expect(validateVitals({ pulse: "", notes: "patient asleep" })).toEqual({ ok: false, message: "Enter at least one vital sign" });
  });

  it("rejects readings that cannot be real", () => {
    expect(validateVitals({ temperature: "150" })).toEqual({ ok: false, message: "Temperature must be between 90 and 110 °F" });
    expect(validateVitals({ spo2: "101" })).toEqual({ ok: false, message: "SpO₂ must be between 50 and 100 %" });
    expect(validateVitals({ pulse: "abc" })).toEqual({ ok: false, message: "Pulse must be a number" });
  });

  it("requires both blood pressure numbers together, systolic above diastolic", () => {
    expect(validateVitals({ systolic: "120" })).toEqual({ ok: false, message: "Enter both systolic and diastolic blood pressure" });
    expect(validateVitals({ systolic: "70", diastolic: "90" })).toEqual({ ok: false, message: "Systolic pressure must be higher than diastolic" });
  });
});

describe("vitalFlags", () => {
  it("returns nothing for normal readings", () => {
    expect(vitalFlags({ temperature: 98.6, pulse: 72, systolic: 120, diastolic: 80, respiratoryRate: 16, spo2: 98 })).toEqual([]);
  });

  it("flags readings a nurse must act on", () => {
    expect(vitalFlags({ temperature: 101.2, pulse: 118, systolic: 165, diastolic: 100, spo2: 91, respiratoryRate: 26 })).toEqual([
      { field: "temperature", level: "high", label: "Fever" },
      { field: "pulse", level: "high", label: "Tachycardia" },
      { field: "bloodPressure", level: "high", label: "High BP" },
      { field: "respiratoryRate", level: "high", label: "Fast breathing" },
      { field: "spo2", level: "low", label: "Low oxygen" },
    ]);
  });

  it("flags low readings", () => {
    expect(vitalFlags({ pulse: 48, systolic: 85, diastolic: 55, temperature: 95 })).toEqual([
      { field: "temperature", level: "low", label: "Hypothermia" },
      { field: "pulse", level: "low", label: "Bradycardia" },
      { field: "bloodPressure", level: "low", label: "Low BP" },
    ]);
  });
});
