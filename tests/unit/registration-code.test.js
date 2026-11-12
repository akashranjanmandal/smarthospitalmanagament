import { describe, it, expect } from "vitest";
import { roleFromRegistrationCode, normalizeRegistrationCode } from "@/lib/registration-code";

describe("staff registration codes", () => {
  it("tells staff which role their code is for, from its prefix", () => {
    expect(roleFromRegistrationCode("DOC-84KM-PX21")).toBe("DOCTOR");
    expect(roleFromRegistrationCode("nur-84km-px21")).toBe("NURSE");
    expect(roleFromRegistrationCode("WAT-84KM-PX21")).toBe("WARD_ATTENDANT");
    expect(roleFromRegistrationCode("REC-84KM-PX21")).toBe("RECEPTIONIST");
    expect(roleFromRegistrationCode("ADM-84KM-PX21")).toBe("ADMIN");
  });

  it("returns nothing for codes it does not recognise", () => {
    expect(roleFromRegistrationCode("XYZ-1234-5678")).toBeNull();
    expect(roleFromRegistrationCode("")).toBeNull();
  });

  it("tidies what people type: case, spaces and missing dashes", () => {
    expect(normalizeRegistrationCode(" doc 84km px21 ")).toBe("DOC-84KM-PX21");
    expect(normalizeRegistrationCode("doc84kmpx21")).toBe("DOC-84KM-PX21");
    expect(normalizeRegistrationCode("DOC-84KM-PX21")).toBe("DOC-84KM-PX21");
  });
});

describe("kiosk device codes", () => {
  it("are recognised", () => {
    expect(roleFromRegistrationCode("KSK-84KM-PX21")).toBe("KIOSK");
  });
});
