import { describe, it, expect } from "vitest";
import { hasPermission, canCreate, canRead, canUpdate, canDelete, isOwnOnly, canAccessRoute } from "@/lib/permissions";

describe("module permissions", () => {
  it("gives super admin every permission", () => {
    expect(canDelete("billing", "SUPER_ADMIN")).toBe(true);
    expect(canCreate("medicalRecords", "SUPER_ADMIN")).toBe(true);
    expect(hasPermission("unknownModule", "SUPER_ADMIN", "read")).toBe(true);
  });

  it("only lets doctors write medical records and prescriptions", () => {
    expect(canCreate("medicalRecords", "DOCTOR")).toBe(true);
    expect(canCreate("prescriptions", "DOCTOR")).toBe(true);
    for (const role of ["ADMIN", "RECEPTIONIST", "PATIENT"]) {
      expect(canCreate("medicalRecords", role)).toBe(false);
      expect(canCreate("prescriptions", role)).toBe(false);
    }
  });

  it("keeps doctors and patients out of billing writes", () => {
    expect(canCreate("billing", "DOCTOR")).toBe(false);
    expect(canUpdate("billing", "PATIENT")).toBe(false);
    expect(canCreate("billing", "RECEPTIONIST")).toBe(true);
  });

  it("treats 'own' access as read access", () => {
    expect(canRead("patients", "PATIENT")).toBe(true);
    expect(isOwnOnly("patients", "PATIENT")).toBe(true);
    expect(isOwnOnly("patients", "RECEPTIONIST")).toBe(false);
  });

  it("denies unknown modules and roles", () => {
    expect(hasPermission("nope", "ADMIN", "read")).toBe(false);
    expect(hasPermission("billing", "JANITOR", "read")).toBe(false);
  });
});

describe("canAccessRoute (page-level access)", () => {
  const allowed = [
    ["PATIENT", "/dashboard"],
    ["PATIENT", "/appointments/new"],
    ["PATIENT", "/medical-records"],
    ["PATIENT", "/billing/abc123"],
    ["PATIENT", "/feedback"],
    ["PATIENT", "/profile"],
    ["DOCTOR", "/medical-records/new"],
    ["DOCTOR", "/medical-records/abc/edit"],
    ["DOCTOR", "/feedback/manage"],
    ["RECEPTIONIST", "/patients/new"],
    ["RECEPTIONIST", "/billing/new"],
    ["RECEPTIONIST", "/beds"],
    ["ADMIN", "/admin/registration-codes"],
    ["ADMIN", "/doctors/abc/edit"],
    ["SUPER_ADMIN", "/medical-records/new"],
  ];
  it.each(allowed)("%s can open %s", (role, path) => {
    expect(canAccessRoute(role, path)).toBe(true);
  });

  const denied = [
    ["PATIENT", "/admin/registration-codes"],
    ["PATIENT", "/departments/new"],
    ["PATIENT", "/doctors/new"],
    ["PATIENT", "/patients/new"],
    ["PATIENT", "/billing/new"],
    ["PATIENT", "/beds"],
    ["PATIENT", "/feedback/manage"],
    ["PATIENT", "/medical-records/new"],
    ["PATIENT", "/prescriptions/new"],
    ["DOCTOR", "/billing"],
    ["DOCTOR", "/departments"],
    ["DOCTOR", "/admin/registration-codes"],
    ["RECEPTIONIST", "/medical-records/new"],
    ["RECEPTIONIST", "/admin/registration-codes"],
    ["ADMIN", "/medical-records/new"],
  ];
  it.each(denied)("%s cannot open %s", (role, path) => {
    expect(canAccessRoute(role, path)).toBe(false);
  });

  it("does not confuse /feedback with /feedback/manage", () => {
    expect(canAccessRoute("PATIENT", "/feedback")).toBe(true);
    expect(canAccessRoute("PATIENT", "/feedback/manage")).toBe(false);
  });
});

describe("ward staff and in-patient care", () => {
  it("lets nurses chart care but not admit or discharge", () => {
    expect(canCreate("nursing", "NURSE")).toBe(true);
    expect(canUpdate("nursing", "NURSE")).toBe(true);
    expect(canRead("admissions", "NURSE")).toBe(true);
    expect(canCreate("admissions", "NURSE")).toBe(false);
    expect(canUpdate("admissions", "NURSE")).toBe(false);
  });

  it("lets doctors chart rounds and discharge", () => {
    expect(canCreate("nursing", "DOCTOR")).toBe(true);
    expect(canUpdate("admissions", "DOCTOR")).toBe(true);
  });

  it("lets front office admit but not chart", () => {
    expect(canCreate("admissions", "RECEPTIONIST")).toBe(true);
    expect(canCreate("nursing", "RECEPTIONIST")).toBe(false);
  });

  it("lets ward attendants update bed housekeeping status only", () => {
    expect(canUpdate("beds", "WARD_ATTENDANT")).toBe(true);
    expect(canRead("admissions", "WARD_ATTENDANT")).toBe(true);
    expect(canCreate("admissions", "WARD_ATTENDANT")).toBe(false);
    expect(canCreate("nursing", "WARD_ATTENDANT")).toBe(false);
    expect(canRead("billing", "WARD_ATTENDANT")).toBe(false);
  });

  it("shows the audit trail to administrators only", () => {
    expect(canRead("audit", "ADMIN")).toBe(true);
    for (const role of ["RECEPTIONIST", "DOCTOR", "NURSE", "WARD_ATTENDANT", "PATIENT"]) {
      expect(canRead("audit", role)).toBe(false);
    }
  });

  it.each([
    ["NURSE", "/admissions", true],
    ["NURSE", "/admissions/abc", true],
    ["NURSE", "/admissions/new", false],
    ["NURSE", "/handover", true],
    ["NURSE", "/beds", true],
    ["NURSE", "/billing", false],
    ["WARD_ATTENDANT", "/beds", true],
    ["WARD_ATTENDANT", "/handover", false],
    ["RECEPTIONIST", "/admissions/new", true],
    ["RECEPTIONIST", "/handover", false],
    ["PATIENT", "/admissions", true],
    ["PATIENT", "/admissions/new", false],
    ["ADMIN", "/admin/audit-logs", true],
    ["RECEPTIONIST", "/admin/audit-logs", false],
    ["DOCTOR", "/admin/audit-logs", false],
  ])("%s → %s allowed: %s", (role, path, allowed) => {
    expect(canAccessRoute(role, path)).toBe(allowed);
  });
});

describe("OPD queue access", () => {
  it.each([
    ["RECEPTIONIST", "/queue", true],
    ["DOCTOR", "/queue", true],
    ["NURSE", "/queue-display", true],
    ["PATIENT", "/queue", false],
    ["WARD_ATTENDANT", "/queue-display", false],
  ])("%s → %s allowed: %s", (role, path, allowed) => {
    expect(canAccessRoute(role, path)).toBe(allowed);
  });
});

describe("billing and insurance desk", () => {
  it("lets the insurance desk work claims but not post charges or change clinical records", () => {
    expect(canCreate("insurance", "INSURANCE_DESK")).toBe(true);
    expect(canRead("billing", "INSURANCE_DESK")).toBe(true);
    expect(canCreate("billing", "INSURANCE_DESK")).toBe(false);
    expect(canCreate("nursing", "INSURANCE_DESK")).toBe(false);
    expect(canUpdate("admissions", "INSURANCE_DESK")).toBe(false);
  });

  it("lets the front office capture payer details but not answer pre-authorisations", () => {
    expect(canUpdate("insurance", "RECEPTIONIST")).toBe(true);
    expect(canCreate("insurance", "RECEPTIONIST")).toBe(false);
  });

  it("keeps the price list in administrators' hands", () => {
    expect(canUpdate("tariffs", "ADMIN")).toBe(true);
    expect(canRead("tariffs", "RECEPTIONIST")).toBe(true);
    expect(canUpdate("tariffs", "RECEPTIONIST")).toBe(false);
  });

  it.each([
    ["INSURANCE_DESK", "/insurance", true],
    ["ADMIN", "/insurance", true],
    ["RECEPTIONIST", "/insurance", false],
    ["ADMIN", "/admin/tariffs", true],
    ["INSURANCE_DESK", "/admin/tariffs", false],
    ["INSURANCE_DESK", "/admissions/abc", true],
    ["INSURANCE_DESK", "/handover", false],
  ])("%s → %s allowed: %s", (role, path, allowed) => {
    expect(canAccessRoute(role, path)).toBe(allowed);
  });
});

describe("diet and meals", () => {
  it("lets only doctors set the diet, patients and nurses order, kitchen keep the menu", () => {
    expect(canUpdate("diet", "DOCTOR")).toBe(true);
    expect(canUpdate("diet", "NURSE")).toBe(false);
    expect(canCreate("meals", "PATIENT")).toBe(true);
    expect(canCreate("meals", "NURSE")).toBe(true);
    expect(canCreate("meals", "WARD_ATTENDANT")).toBe(false);
    expect(canUpdate("menu", "KITCHEN")).toBe(true);
    expect(canUpdate("menu", "NURSE")).toBe(false);
  });

  it.each([
    ["KITCHEN", "/kitchen", true],
    ["KITCHEN", "/kitchen/menu", true],
    ["WARD_ATTENDANT", "/kitchen", true],
    ["WARD_ATTENDANT", "/kitchen/menu", false],
    ["PATIENT", "/my-meals", true],
    ["PATIENT", "/kitchen", false],
    ["DOCTOR", "/kitchen", false],
  ])("%s → %s allowed: %s", (role, path, allowed) => {
    expect(canAccessRoute(role, path)).toBe(allowed);
  });
});
