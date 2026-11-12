import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  otpCode: { updateMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { createAndStoreOtp, normalizePhone, isValidIndianPhone } = await import("@/lib/auth/otp");

describe("phone helpers", () => {
  it("normalizes +91 numbers to 10 digits", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });

  it("validates Indian mobile numbers", () => {
    expect(isValidIndianPhone("9876543210")).toBe(true);
    expect(isValidIndianPhone("1234567890")).toBe(false);
    expect(isValidIndianPhone("98765")).toBe(false);
  });
});

describe("createAndStoreOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OTP_STATIC_CODE", "123456");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects invalid numbers without storing anything", async () => {
    const r = await createAndStoreOtp("12345");
    expect(r.success).toBe(false);
    expect(prismaMock.otpCode.create).not.toHaveBeenCalled();
  });

  it("in development, uses the static code and returns it for testing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const r = await createAndStoreOtp("9876543210");
    expect(r.success).toBe(true);
    expect(r.devCode).toBe("123456");
    expect(prismaMock.otpCode.create.mock.calls[0][0].data.code).toBe("123456");
  });

  it("in production, never returns the code and never uses the static code", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const codes = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await createAndStoreOtp("9876543210");
      expect(r.success).toBe(true);
      expect(r).not.toHaveProperty("devCode");
      codes.add(prismaMock.otpCode.create.mock.calls[i][0].data.code);
    }
    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
      expect(code).not.toBe("123456");
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
