import { describe, it, expect } from "vitest";
import { redact, changedFields, describeAuditEntry } from "@/lib/audit/format";

describe("audit redaction", () => {
  it("never stores secrets", () => {
    expect(redact({ email: "a@b.c", password: "$2a$hash", code: "123456", token: "abc", tokenHash: "x", nested: { password: "p" } }))
      .toEqual({ email: "a@b.c", password: "[redacted]", code: "[redacted]", token: "[redacted]", tokenHash: "[redacted]", nested: { password: "[redacted]" } });
  });

  it("keeps dates and nulls readable", () => {
    expect(redact({ at: new Date("2026-10-24T10:00:00.000Z"), x: null })).toEqual({ at: "2026-10-24T10:00:00.000Z", x: null });
  });
});

describe("changedFields", () => {
  it("lists fields whose values changed, ignoring bookkeeping timestamps", () => {
    const before = { name: "CCU", floor: 2, updatedAt: "2026-01-01", notes: null };
    const after = { name: "CCU", floor: 3, updatedAt: "2026-02-01", notes: "moved" };
    expect(changedFields(before, after)).toEqual(["floor", "notes"]);
  });
});

describe("describeAuditEntry", () => {
  it("writes a one-line, human summary", () => {
    expect(describeAuditEntry({ action: "CREATE", entity: "Admission" })).toBe("Created admission");
    expect(describeAuditEntry({ action: "UPDATE", entity: "Bed", changes: { fields: ["status", "patientId"] } })).toBe("Updated bed (status, patientId)");
    expect(describeAuditEntry({ action: "DELETE", entity: "MedicalRecord" })).toBe("Deleted medical record");
    expect(describeAuditEntry({ action: "LOGIN", entity: "User" })).toBe("Signed in");
    expect(describeAuditEntry({ action: "LOGIN_FAILED", entity: "User" })).toBe("Failed sign-in attempt");
  });
});
