import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/actions/patients";
import { createAndStoreOtp, verifyPhoneOtp } from "@/lib/auth/otp";
import { createUser } from "../helpers/db";
import { loginAs, logout } from "../helpers/cookie-jar";

describe("mobile OTP sign-in", () => {
  it("signs a patient registered at the front desk into their existing record, not a new one", async () => {
    await loginAs(await createUser({ role: "RECEPTIONIST" }));
    const { data: walkIn } = await createPatient({ firstName: "Kavya", lastName: "Reddy", gender: "FEMALE", dateOfBirth: "1992-03-14", phone: "9876511111" });
    logout();

    const sent = await createAndStoreOtp("9876511111");
    const res = await verifyPhoneOtp("9876511111", sent.devCode);

    expect(res).toMatchObject({ success: true, needsProfile: false, user: { id: walkIn.userId, firstName: "Kavya" } });
    expect(await prisma.patient.count({ where: { phone: "9876511111" } })).toBe(1);
  });

  it("rejects a wrong or reused code", async () => {
    const sent = await createAndStoreOtp("9876522222");
    expect((await verifyPhoneOtp("9876522222", "000000")).success).toBe(false);
    expect((await verifyPhoneOtp("9876522222", sent.devCode)).success).toBe(true);
    expect((await verifyPhoneOtp("9876522222", sent.devCode)).success).toBe(false);
  });
});
