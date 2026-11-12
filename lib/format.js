// Display helpers shared by server and client components. Times are always shown in Indian Standard Time.
const TZ = "Asia/Kolkata";

export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}

export function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true });
}

export function ageYears(dob, at = new Date()) {
  if (!dob) return null;
  const b = new Date(dob);
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age -= 1;
  return age;
}

const SEX = { MALE: "M", FEMALE: "F", OTHER: "O" };

/** "34 Y / M" — the age/sex shorthand used on Indian hospital charts. */
export function ageSex(patient) {
  const age = ageYears(patient?.dateOfBirth);
  return `${age ?? "?"} Y / ${SEX[patient?.gender] ?? "—"}`;
}

export const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ");

export const CONDITION_LABELS = {
  RECOVERED: "Recovered",
  IMPROVED: "Improved",
  STABLE: "Stable",
  REFERRED: "Referred to another centre",
  AGAINST_MEDICAL_ADVICE: "Left against medical advice",
};

/** Indian rupee amount, e.g. ₹1,23,456.5 */
export const inr = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const CATEGORY_LABELS = {
  ROOM: "Room", CONSULTATION: "Consultation", PROCEDURE: "Procedure", LAB: "Laboratory", RADIOLOGY: "Radiology",
  PHARMACY: "Pharmacy", CONSUMABLE: "Consumables", NURSING: "Nursing", OTHER: "Other",
};
