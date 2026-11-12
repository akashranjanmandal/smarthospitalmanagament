import { describe, it, expect } from "vitest";
import { signScopedToken, verifyScopedToken, signToken } from "@/lib/auth/jwt";

describe("scoped tokens (kiosk tickets)", () => {
  it("verify only for the purpose they were issued for", async () => {
    const t = await signScopedToken({ purpose: "kiosk", phone: "9123456780" }, "10m");
    expect(await verifyScopedToken(t, "kiosk")).toMatchObject({ phone: "9123456780" });
    expect(await verifyScopedToken(t, "other")).toBeNull();
  });

  it("are never accepted in place of a sign-in token, and vice versa", async () => {
    const session = await signToken({ userId: "u1", role: "ADMIN" });
    expect(await verifyScopedToken(session, "kiosk")).toBeNull();
    expect(await verifyScopedToken("garbage", "kiosk")).toBeNull();
  });

  it("expire", async () => {
    const t = await signScopedToken({ purpose: "kiosk" }, "-1s");
    expect(await verifyScopedToken(t, "kiosk")).toBeNull();
  });
});
