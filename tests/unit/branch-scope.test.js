import { describe, it, expect } from "vitest";
import { isChainWide, branchScope, resolveBranchId } from "@/lib/branch-scope";

describe("branch scope", () => {
  it("is chain-wide only for SUPER_ADMIN", () => {
    expect(isChainWide("SUPER_ADMIN")).toBe(true);
    for (const role of ["ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"]) expect(isChainWide(role)).toBe(false);
  });

  describe("branchScope", () => {
    it("adds no filter for a chain-wide role", () => {
      expect(branchScope({ role: "SUPER_ADMIN", branchId: "b1" })).toEqual({});
    });

    it("filters to the user's own branch otherwise", () => {
      expect(branchScope({ role: "ADMIN", branchId: "b1" })).toEqual({ branchId: "b1" });
    });

    it("filters to an impossible value rather than showing everything when branchId is missing", () => {
      expect(branchScope({ role: "ADMIN", branchId: null }).branchId).not.toBeNull();
    });

    it("uses the field name given", () => {
      expect(branchScope({ role: "ADMIN", branchId: "b1" }, "bed.branchId")).toEqual({ "bed.branchId": "b1" });
    });
  });

  describe("resolveBranchId", () => {
    it("uses the admin's own branch and ignores any branch they tried to request", () => {
      expect(resolveBranchId({ role: "ADMIN", branchId: "b1" }, "someone-elses-branch")).toEqual({ ok: true, branchId: "b1" });
    });

    it("requires a branch to be chosen for a chain-wide role", () => {
      expect(resolveBranchId({ role: "SUPER_ADMIN", branchId: null }, undefined)).toMatchObject({ ok: false });
      expect(resolveBranchId({ role: "SUPER_ADMIN", branchId: null }, "b2")).toEqual({ ok: true, branchId: "b2" });
    });

    it("refuses when a branch-scoped admin has no branch of their own", () => {
      expect(resolveBranchId({ role: "ADMIN", branchId: null }, "b1")).toMatchObject({ ok: false });
    });
  });
});
