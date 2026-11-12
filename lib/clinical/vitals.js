// Vital sign limits. "range" rejects readings that cannot be real; "normal" drives the alert flags.
export const VITALS = {
  temperature: { label: "Temperature", unit: "°F", range: [90, 110], decimal: true },
  pulse: { label: "Pulse", unit: "bpm", range: [20, 250] },
  systolic: { label: "Systolic BP", unit: "mmHg", range: [50, 260] },
  diastolic: { label: "Diastolic BP", unit: "mmHg", range: [20, 160] },
  respiratoryRate: { label: "Respiratory rate", unit: "/min", range: [4, 60] },
  spo2: { label: "SpO₂", unit: "%", range: [50, 100] },
  bloodSugar: { label: "Blood sugar", unit: "mg/dL", range: [20, 600] },
  painScore: { label: "Pain score", unit: "/10", range: [0, 10] },
};

const FIELD_NAMES = { temperature: "Temperature", pulse: "Pulse", systolic: "Systolic pressure", diastolic: "Diastolic pressure", respiratoryRate: "Respiratory rate", spo2: "SpO₂", bloodSugar: "Blood sugar", painScore: "Pain score" };

export function validateVitals(input = {}) {
  const values = {};
  for (const [field, spec] of Object.entries(VITALS)) {
    const raw = input[field];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, message: `${FIELD_NAMES[field]} must be a number` };
    const [min, max] = spec.range;
    if (n < min || n > max) return { ok: false, message: `${FIELD_NAMES[field]} must be between ${min} and ${max} ${spec.unit}` };
    values[field] = spec.decimal ? Math.round(n * 10) / 10 : Math.round(n);
  }
  if (Object.keys(values).length === 0) return { ok: false, message: "Enter at least one vital sign" };
  if ((values.systolic === undefined) !== (values.diastolic === undefined)) {
    return { ok: false, message: "Enter both systolic and diastolic blood pressure" };
  }
  if (values.systolic !== undefined && values.systolic <= values.diastolic) {
    return { ok: false, message: "Systolic pressure must be higher than diastolic" };
  }
  return { ok: true, values };
}

// Adult early-warning thresholds a ward nurse acts on.
export function vitalFlags(v = {}) {
  const flags = [];
  const add = (field, level, label) => flags.push({ field, level, label });
  if (v.temperature != null) {
    if (v.temperature >= 100.4) add("temperature", "high", "Fever");
    else if (v.temperature < 96) add("temperature", "low", "Hypothermia");
  }
  if (v.pulse != null) {
    if (v.pulse > 100) add("pulse", "high", "Tachycardia");
    else if (v.pulse < 60) add("pulse", "low", "Bradycardia");
  }
  if (v.systolic != null) {
    if (v.systolic >= 140 || v.diastolic >= 90) add("bloodPressure", "high", "High BP");
    else if (v.systolic < 90) add("bloodPressure", "low", "Low BP");
  }
  if (v.respiratoryRate != null) {
    if (v.respiratoryRate > 20) add("respiratoryRate", "high", "Fast breathing");
    else if (v.respiratoryRate < 12) add("respiratoryRate", "low", "Slow breathing");
  }
  if (v.spo2 != null && v.spo2 < 94) add("spo2", "low", "Low oxygen");
  if (v.bloodSugar != null) {
    if (v.bloodSugar > 250) add("bloodSugar", "high", "High sugar");
    else if (v.bloodSugar < 70) add("bloodSugar", "low", "Low sugar");
  }
  if (v.painScore != null && v.painScore >= 7) add("painScore", "high", "Severe pain");
  return flags;
}
