import { describe, it, expect, vi, beforeEach } from "vitest";

const sendPasswordResetEmail = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail }));

const { prisma } = await import("@/lib/prisma");
const { requestPasswordReset, resetPasswordWithToken } = await import("@/actions/auth-reset");
const { authenticateUser } = await import("@/lib/auth");
const { createUser } = await import("../helpers/db");

describe("password reset", () => {
  beforeEach(() => sendPasswordResetEmail.mockClear());

  it("emails a reset link to a registered user", async () => {
    await createUser({ email: "known@test.local" });
    const r = await requestPasswordReset("known@test.local");
    expect(r.success).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(sendPasswordResetEmail.mock.calls[0][1]).toMatch(/\/reset-password\?token=[a-f0-9]{64}$/);
  });

  it("gives the same answer for unknown emails, so it doesn't reveal who has an account", async () => {
    await createUser({ email: "known@test.local" });
    const known = await requestPasswordReset("known@test.local");
    const unknown = await requestPasswordReset("nobody@test.local");
    expect(unknown.success).toBe(true);
    expect(unknown.message).toBe(known.message);
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("resets the password with a valid token, once", async () => {
    await createUser({ email: "reset@test.local" });
    await requestPasswordReset("reset@test.local");
    const token = sendPasswordResetEmail.mock.calls[0][1].split("token=")[1];
    expect((await resetPasswordWithToken({ token, newPassword: "NewPass@1" })).success).toBe(true);
    expect(await authenticateUser("reset@test.local", "NewPass@1")).toBeTruthy();
    expect((await resetPasswordWithToken({ token, newPassword: "Again@123" })).success).toBe(false);
  });

  it("rejects expired tokens", async () => {
    await createUser({ email: "exp@test.local" });
    await prisma.passwordResetToken.create({ data: { email: "exp@test.local", token: "expired-token", expiresAt: new Date(Date.now() - 1000) } });
    expect((await resetPasswordWithToken({ token: "expired-token", newPassword: "NewPass@1" })).success).toBe(false);
  });
});
