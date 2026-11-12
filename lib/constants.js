export const ROLES = {
  ADMIN: "ADMIN",
  DOCTOR: "DOCTOR",
  RECEPTIONIST: "RECEPTIONIST",
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
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  NURSE: "Nurse",
  WARD_ATTENDANT: "Ward Attendant",
  INSURANCE_DESK: "Insurance / TPA Desk",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Lab / Radiology Technician",
  KITCHEN: "Kitchen / Dietitian",
  KIOSK: "Self-service Kiosk",
  PATIENT: "Patient",
};

export const APPOINTMENT_STATUS = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
};

export const PAYMENT_METHOD = {
  CASH: "CASH",
  CARD: "CARD",
  UPI: "UPI",
};

export const GENDER = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
};

export const DEPARTMENT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const BED_STATUS = {
  VACANT: "VACANT",
  OCCUPIED: "OCCUPIED",
  RESERVED: "RESERVED",
  NEEDS_CLEANING: "NEEDS_CLEANING",
};

export const BED_STATUS_LABELS = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  NEEDS_CLEANING: "Needs Cleaning",
};

export const BED_TYPE = {
  GENERAL: "GENERAL",
  SEMI_PRIVATE: "SEMI_PRIVATE",
  PRIVATE: "PRIVATE",
  ICU: "ICU",
  NICU: "NICU",
  EMERGENCY: "EMERGENCY",
  MATERNITY: "MATERNITY",
};

export const BED_TYPE_LABELS = {
  GENERAL: "General",
  SEMI_PRIVATE: "Semi-Private",
  PRIVATE: "Private",
  ICU: "ICU",
  NICU: "NICU",
  EMERGENCY: "Emergency",
  MATERNITY: "Maternity",
};

export const GENDER_WARD = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  MIXED: "MIXED",
};

export const GENDER_WARD_LABELS = {
  MALE: "Male",
  FEMALE: "Female",
  MIXED: "Mixed",
};

export const COMPLAINT_TYPE = {
  COMPLAINT: "COMPLAINT",
  FEEDBACK: "FEEDBACK",
  COMPLIMENT: "COMPLIMENT",
  SUGGESTION: "SUGGESTION",
};

export const COMPLAINT_TYPE_LABELS = {
  COMPLAINT: "Complaint",
  FEEDBACK: "Feedback",
  COMPLIMENT: "Compliment",
  SUGGESTION: "Suggestion",
};

export const COMPLAINT_CATEGORY = {
  STAFF_BEHAVIOR: "STAFF_BEHAVIOR",
  WAIT_TIME: "WAIT_TIME",
  CLEANLINESS: "CLEANLINESS",
  BILLING_ISSUE: "BILLING_ISSUE",
  TREATMENT_QUALITY: "TREATMENT_QUALITY",
  FACILITY_AMENITIES: "FACILITY_AMENITIES",
  MEDICATION_ERROR: "MEDICATION_ERROR",
  OTHER: "OTHER",
};

export const COMPLAINT_CATEGORY_LABELS = {
  STAFF_BEHAVIOR: "Staff Behavior & Conduct",
  WAIT_TIME: "Long Wait Times / Delays",
  CLEANLINESS: "Hygiene & Cleanliness",
  BILLING_ISSUE: "Billing & Insurance Issue",
  TREATMENT_QUALITY: "Medical Treatment & Care Quality",
  FACILITY_AMENITIES: "Facility & Infrastructure",
  MEDICATION_ERROR: "Pharmacy & Medication",
  OTHER: "General / Other",
};

export const COMPLAINT_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export const COMPLAINT_SEVERITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const SLA_HOURS_BY_SEVERITY = {
  CRITICAL: 12,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

export const COMPLAINT_STATUS = {
  SUBMITTED: "SUBMITTED",
  ASSIGNED: "ASSIGNED",
  UNDER_INVESTIGATION: "UNDER_INVESTIGATION",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
  CLOSED: "CLOSED",
};

export const COMPLAINT_STATUS_LABELS = {
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned",
  UNDER_INVESTIGATION: "Under Investigation",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export const ESCALATION_LEVEL = {
  LEVEL_1_DEPT_HEAD: "LEVEL_1_DEPT_HEAD",
  LEVEL_2_ADMIN: "LEVEL_2_ADMIN",
  LEVEL_3_DIRECTOR: "LEVEL_3_DIRECTOR",
};

export const ESCALATION_LEVEL_LABELS = {
  LEVEL_1_DEPT_HEAD: "Level 1 (Department Head)",
  LEVEL_2_ADMIN: "Level 2 (Hospital Administrator)",
  LEVEL_3_DIRECTOR: "Level 3 (Medical Director)",
};

