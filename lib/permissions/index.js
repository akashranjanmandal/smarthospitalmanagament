import { ROLES } from "@/lib/roles";

const C = "create";
const R = "read";
const U = "update";
const D = "del";
const OWN = "own";
const ALL = "all";

export const PERMISSIONS = {
  departments: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.DOCTOR]:      [],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PHARMACIST]: [R],
    [ROLES.LAB_TECH]: [R],
    [ROLES.PATIENT]:     [R],
  },
  doctors: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.DOCTOR]:      [OWN],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PHARMACIST]: [R],
    [ROLES.LAB_TECH]: [R],
    [ROLES.PATIENT]:     [R],
  },
  patients: {
    [ROLES.ADMIN]:       [R, U],
    [ROLES.RECEPTIONIST]: [C, R, U],
    [ROLES.DOCTOR]:      [R],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PHARMACIST]: [R],
    [ROLES.LAB_TECH]: [R],
    [ROLES.PATIENT]:     [OWN],
  },
  appointments: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [C, R, U],
    [ROLES.DOCTOR]:      [C, R, U, OWN],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [C, R, U, OWN],
  },
  medicalRecords: {
    [ROLES.ADMIN]:       [R],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [R, OWN],
  },
  prescriptions: {
    [ROLES.ADMIN]:       [R],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PHARMACIST]: [R],
    [ROLES.PATIENT]:     [R, OWN],
  },
  billing: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [C, R, U],
    [ROLES.DOCTOR]:      [],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PATIENT]:     [R, OWN],
  },
  reports: {
    [ROLES.ADMIN]:       [ALL],
    [ROLES.RECEPTIONIST]: [],
    [ROLES.DOCTOR]:      [],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [],
  },
  beds: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [R, U],
    [ROLES.DOCTOR]:      [R],
    [ROLES.NURSE]:       [R, U],
    [ROLES.WARD_ATTENDANT]: [R, U],
    [ROLES.PATIENT]:     [],
  },
  // In-patient stays: admit (front office, doctors), discharge (doctors), view (ward staff, own for patients)
  admissions: {
    [ROLES.ADMIN]:       [C, R, U],
    [ROLES.RECEPTIONIST]: [C, R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [R],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PHARMACIST]: [R],
    [ROLES.PATIENT]:     [OWN],
  },
  // Bedside charting: vitals, clinical notes, shift handover
  nursing: {
    [ROLES.ADMIN]:       [R],
    [ROLES.RECEPTIONIST]: [],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [C, R, U],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [],
  },
  // OPD token queue: check-in at the front desk, "call next" by the doctor, waiting-room display
  queue: {
    [ROLES.ADMIN]:       [R, U],
    [ROLES.RECEPTIONIST]: [R, U],
    [ROLES.DOCTOR]:      [R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [],
  },
  // Lobby self-service kiosk device: identify patient by OTP, register, check in, walk-in token
  // Price list (room rates, services). Administrators maintain it; billing and insurance read it.
  tariffs: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.INSURANCE_DESK]: [R],
  },
  // Payer details (front office captures; update), pre-authorisations and claims (desk only; create)
  insurance: {
    [ROLES.ADMIN]:       [C, R, U],
    [ROLES.INSURANCE_DESK]: [C, R, U],
    [ROLES.RECEPTIONIST]: [R, U],
    [ROLES.DOCTOR]:      [R],
  },
  // Pharmacy queue: prepare, make ready, dispense / issue to ward
  pharmacy: {
    [ROLES.ADMIN]:       [C, R, U],
    [ROLES.PHARMACIST]:  [C, R, U],
  },
  // Medicine list and stock: kept by pharmacy, read by prescribers and nurses
  formulary: {
    [ROLES.ADMIN]:       [C, R, U],
    [ROLES.PHARMACIST]:  [C, R, U],
    [ROLES.DOCTOR]:      [R],
    [ROLES.NURSE]:       [R],
  },
  // In-patient medicine orders: doctors order and stop; nurses chart doses through the nursing module
  medicationOrders: {
    [ROLES.ADMIN]:       [R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.PHARMACIST]:  [R],
  },
  // Lab and radiology orders: doctors order; nurses and lab collect; lab enters and verifies; patients see their own verified reports
  labOrders: {
    [ROLES.ADMIN]:       [R, U],
    [ROLES.DOCTOR]:      [C, R],
    [ROLES.NURSE]:       [R, U],
    [ROLES.LAB_TECH]:    [R, U],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.INSURANCE_DESK]: [R],
    [ROLES.PATIENT]:     [OWN],
  },
  // Test catalogue with reference ranges
  labCatalog: {
    [ROLES.ADMIN]:       [C, R, U],
  },
  // Diet type for an in-patient stay: set by doctors
  diet: {
    [ROLES.ADMIN]:       [R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R],
    [ROLES.KITCHEN]:     [R],
    [ROLES.PATIENT]:     [OWN],
  },
  // Meal orders: patients choose their own, nurses choose for them, kitchen prepares, attendants deliver
  meals: {
    [ROLES.ADMIN]:       [R, U],
    [ROLES.PATIENT]:     [C, OWN],
    [ROLES.NURSE]:       [C, R, U],
    [ROLES.DOCTOR]:      [R],
    [ROLES.KITCHEN]:     [R, U],
    [ROLES.WARD_ATTENDANT]: [R, U],
  },
  // Hospital menu
  menu: {
    [ROLES.ADMIN]:       [C, R, U],
    [ROLES.KITCHEN]:     [C, R, U],
  },
  kiosk: {
    [ROLES.KIOSK]:       [C, R, U],
  },
  audit: {
    [ROLES.ADMIN]:       [R],
    [ROLES.RECEPTIONIST]: [],
    [ROLES.DOCTOR]:      [],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [],
  },
  feedback: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [C, R, U],
    [ROLES.DOCTOR]:      [R, U],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [C, R],
  },
  // Operation theatre: a doctor books and runs the WHO safety checklist; a nurse assists with
  // the checklist but never books or cancels; ward staff and the front desk only need to see it.
  ot: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [R],
    [ROLES.DOCTOR]:      [C, R, U],
    [ROLES.NURSE]:       [R, U],
    [ROLES.WARD_ATTENDANT]: [R],
    [ROLES.PATIENT]:     [],
  },
  // Who works which ward on a given day. Nurses and ward attendants can read their own schedule;
  // only an admin assigns or removes shifts.
  roster: {
    [ROLES.ADMIN]:       [C, R, U, D],
    [ROLES.RECEPTIONIST]: [],
    [ROLES.DOCTOR]:      [R],
    [ROLES.NURSE]:       [R],
    [ROLES.WARD_ATTENDANT]: [R],
    [ROLES.PATIENT]:     [],
  },
  // Only SUPER_ADMIN can create, rename or deactivate a branch (bypasses this matrix entirely,
  // see hasPermission below); a branch admin may read the chain's branch list (e.g. to show their
  // own branch's details) but never manage branches, including their own.
  branches: {
    [ROLES.ADMIN]:       [R],
    [ROLES.RECEPTIONIST]: [],
    [ROLES.DOCTOR]:      [],
    [ROLES.NURSE]:       [],
    [ROLES.WARD_ATTENDANT]: [],
    [ROLES.PATIENT]:     [],
  },
};

export function hasPermission(module, role, action) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const rolePerms = modulePerms[role];
  if (!rolePerms) return false;
  return rolePerms.includes(action) || rolePerms.includes(ALL);
}

export function canCreate(module, role) {
  return hasPermission(module, role, C);
}

export function canRead(module, role) {
  return hasPermission(module, role, R) || hasPermission(module, role, OWN);
}

export function canUpdate(module, role) {
  return hasPermission(module, role, U);
}

export function canDelete(module, role) {
  return hasPermission(module, role, D);
}

export function isOwnOnly(module, role) {
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const rolePerms = modulePerms[role];
  if (!rolePerms) return false;
  return rolePerms.includes(OWN) && !rolePerms.includes(R);
}

// Page access rules, most specific first. Pages not listed (dashboard, profile, settings, ...) are open to any signed-in user.
const ROUTE_RULES = [
  { pattern: /^\/admin\/registration-codes(\/|$)/, module: "departments", action: C },
  { pattern: /^\/admin\/audit-logs(\/|$)/, module: "audit", action: R },
  { pattern: /^\/admin\/branches(\/|$)/, module: "branches", action: R },
  { pattern: /^\/admin\/roster(\/|$)/, module: "roster", action: U },
  { pattern: /^\/ot(\/|$)/, module: "ot", action: R },
  { pattern: /^\/handover(\/|$)/, module: "nursing", action: R },
  { pattern: /^\/queue(\/|$)/, module: "queue", action: R },
  { pattern: /^\/insurance(\/|$)/, module: "insurance", action: C },
  { pattern: /^\/pharmacy\/formulary(\/|$)/, module: "formulary", action: C },
  { pattern: /^\/lab\/tests(\/|$)/, module: "labCatalog", action: C },
  { pattern: /^\/lab(\/|$)/, module: "labOrders", action: U },
  { pattern: /^\/lab-reports(\/|$)/, module: "labOrders", action: R },
  { pattern: /^\/kitchen\/menu(\/|$)/, module: "menu", action: C },
  { pattern: /^\/kitchen(\/|$)/, module: "meals", action: U },
  { pattern: /^\/my-meals(\/|$)/, module: "meals", action: C },
  { pattern: /^\/pharmacy(\/|$)/, module: "pharmacy", action: R },
  { pattern: /^\/admin\/tariffs(\/|$)/, module: "tariffs", action: U },
  { pattern: /^\/queue-display(\/|$)/, module: "queue", action: R },
  { pattern: /^\/feedback\/manage(\/|$)/, module: "feedback", action: U },
  ...[
    ["departments", "departments"],
    ["doctors", "doctors"],
    ["patients", "patients"],
    ["appointments", "appointments"],
    ["medical-records", "medicalRecords"],
    ["prescriptions", "prescriptions"],
    ["billing", "billing"],
    ["admissions", "admissions"],
  ].flatMap(([segment, module]) => [
    { pattern: new RegExp(`^/${segment}/new/?$`), module, action: C },
    { pattern: new RegExp(`^/${segment}/[^/]+/edit/?$`), module, action: U },
    { pattern: new RegExp(`^/${segment}(/|$)`), module, action: R },
  ]),
  { pattern: /^\/beds(\/|$)/, module: "beds", action: R },
];

export function canAccessRoute(role, pathname) {
  // A kiosk device may only show the kiosk screen; nobody else uses that screen.
  const isKioskPage = /^\/kiosk(\/|$)/.test(pathname);
  if (role === ROLES.KIOSK) return isKioskPage;
  if (isKioskPage) return role === ROLES.SUPER_ADMIN;
  const rule = ROUTE_RULES.find((r) => r.pattern.test(pathname));
  if (!rule) return true;
  if (rule.action === R) return canRead(rule.module, role);
  return hasPermission(rule.module, role, rule.action);
}

export function hasAnyPermission(module, role) {
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const rolePerms = modulePerms[role];
  return rolePerms && rolePerms.length > 0;
}
