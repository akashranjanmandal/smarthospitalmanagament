import { describe, it, expect, vi, afterEach } from "vitest";

// JWT_SECRET is read once, at module load, so each case needs a fresh module instance.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("JWT secret", () => {
  it("refuses to start in production without JWT_SECRET set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    await expect(import("@/lib/auth/jwt")).rejects.toThrow(/JWT_SECRET/);
  });

  it("starts normally in production once JWT_SECRET is set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-long-random-production-secret");
    await expect(import("@/lib/auth/jwt")).resolves.toBeDefined();
  });

  it("still starts outside production without JWT_SECRET, for local development", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "");
    await expect(import("@/lib/auth/jwt")).resolves.toBeDefined();
  });
});
