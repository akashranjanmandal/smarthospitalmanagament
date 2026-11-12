export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  RECEPTIONIST: "RECEPTIONIST",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
  WARD_ATTENDANT: "WARD_ATTENDANT",
  INSURANCE_DESK: "INSURANCE_DESK",
  PHARMACIST: "PHARMACIST",
  LAB_TECH: "LAB_TECH",
  KITCHEN: "KITCHEN",
  KIOSK: "KIOSK",
  PATIENT: "PATIENT",
};

export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Administrator",
  ADMIN: "Administrator",
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  WARD_ATTENDANT: "Ward Attendant",
  INSURANCE_DESK: "Insurance / TPA Desk",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Lab / Radiology Technician",
  KITCHEN: "Kitchen / Dietitian",
  KIOSK: "Self-service Kiosk",
  PATIENT: "Patient",
};

export const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "";

export const ALL_ROLES = Object.values(ROLES);

export function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}
