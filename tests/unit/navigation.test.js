import { describe, it, expect } from "vitest";
import { getNavigationForRole } from "@/lib/navigation";
import { canAccessRoute } from "@/lib/permissions";

const links = (role) => getNavigationForRole(role).flatMap((g) => g.items.map((i) => i.href));

describe("navigation", () => {
  it("gives every role a menu", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE", "WARD_ATTENDANT", "INSURANCE_DESK", "PHARMACIST", "LAB_TECH", "KITCHEN", "PATIENT"]) {
      expect(links(role).length).toBeGreaterThan(0);
    }
  });

  it("only links to pages the role can open", () => {
    for (const role of ["ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE", "WARD_ATTENDANT", "INSURANCE_DESK", "PHARMACIST", "LAB_TECH", "KITCHEN", "PATIENT"]) {
      for (const href of links(role)) expect([role, href, canAccessRoute(role, href)]).toEqual([role, href, true]);
    }
  });

  it("puts the in-patient tools in front of ward staff", () => {
    expect(links("NURSE")).toEqual(expect.arrayContaining(["/admissions", "/handover", "/beds"]));
    expect(links("WARD_ATTENDANT")).toEqual(expect.arrayContaining(["/beds", "/admissions"]));
    expect(links("ADMIN")).toEqual(expect.arrayContaining(["/admissions", "/admin/audit-logs"]));
    expect(links("PATIENT")).toContain("/admissions");
    expect(links("INSURANCE_DESK")).toEqual(expect.arrayContaining(["/insurance", "/admissions"]));
    expect(links("ADMIN")).toEqual(expect.arrayContaining(["/insurance", "/admin/tariffs", "/pharmacy"]));
    expect(links("LAB_TECH")).toContain("/lab");
    expect(links("KITCHEN")).toEqual(expect.arrayContaining(["/kitchen", "/kitchen/menu"]));
    expect(links("PATIENT")).toContain("/my-meals");
    expect(links("WARD_ATTENDANT")).toContain("/kitchen");
    expect(links("PATIENT")).toContain("/lab-reports");
    expect(links("NURSE")).toContain("/lab");
    expect(links("PHARMACIST")).toEqual(expect.arrayContaining(["/pharmacy", "/pharmacy/formulary"]));
  });
});

describe("wayfinder dock and quick actions", () => {
  const ROLES = ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE", "WARD_ATTENDANT", "INSURANCE_DESK", "PHARMACIST", "LAB_TECH", "KITCHEN", "PATIENT"];

  it("pins 2 to 4 everyday places per role, all of which the role can open", async () => {
    const { getPinsForRole } = await import("@/lib/navigation");
    for (const role of ROLES) {
      const pins = getPinsForRole(role);
      expect([role, pins.length >= 2 && pins.length <= 4]).toEqual([role, true]);
      for (const p of pins) expect([role, p.href, canAccessRoute(role, p.href)]).toEqual([role, p.href, true]);
    }
  });

  it("offers quick actions only where the role is allowed to do them", async () => {
    const { getQuickActionsForRole } = await import("@/lib/navigation");
    expect(getQuickActionsForRole("RECEPTIONIST").map((a) => a.href)).toEqual(expect.arrayContaining(["/admissions/new", "/patients/new", "/appointments/new"]));
    expect(getQuickActionsForRole("NURSE").map((a) => a.href)).not.toContain("/admissions/new");
    expect(getQuickActionsForRole("DOCTOR").map((a) => a.href)).toContain("/prescriptions/new");
    for (const role of ROLES) {
      for (const a of getQuickActionsForRole(role)) expect([role, a.href, canAccessRoute(role, a.href)]).toEqual([role, a.href, true]);
    }
  });

  it("gives the kiosk device nothing to navigate to", async () => {
    const { getPinsForRole } = await import("@/lib/navigation");
    expect(getPinsForRole("KIOSK")).toEqual([]);
  });
});
