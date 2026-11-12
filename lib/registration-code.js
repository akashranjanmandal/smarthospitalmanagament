// Staff registration codes look like DOC-84KM-PX21; the prefix names the role the code was issued for.
const PREFIX_ROLES = { ADM: "ADMIN", DOC: "DOCTOR", REC: "RECEPTIONIST", NUR: "NURSE", WAT: "WARD_ATTENDANT", KSK: "KIOSK", INS: "INSURANCE_DESK", PHA: "PHARMACIST", LAB: "LAB_TECH", KIT: "KITCHEN" };

export function normalizeRegistrationCode(input = "") {
  const raw = String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 11) return String(input).trim().toUpperCase();
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
}

export function roleFromRegistrationCode(code = "") {
  const prefix = normalizeRegistrationCode(code).slice(0, 3);
  return PREFIX_ROLES[prefix] ?? null;
}
