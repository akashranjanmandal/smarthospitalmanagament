import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { generateRegistrationCode, verifyRegistrationCode } from "@/actions/registration-codes";
import { createUser, createDepartment, PASSWORD } from "../helpers/db";
import { loginAs, logout, getCookie } from "../helpers/cookie-jar";
import { jsonRequest, readJson } from "../helpers/http";

const signup = (body) => register(jsonRequest("/api/auth/register", { password: PASSWORD, firstName: "New", lastName: "User", ...body })).then(readJson);

async function issueCode(role, departmentId = null, expiresInDays = 7) {
  const admin = await createUser({ role: "ADMIN" });
  await loginAs(admin);
  const r = await generateRegistrationCode({ role, departmentId, expiresInDays });
  logout();
  expect(r.success, r.message).toBe(true);
  return r.data;
}

describe("patient self sign-up", () => {
  it("creates a patient with a patient profile and logs them in", async () => {
    const { status, body } = await signup({ email: "amit@test.local", phone: "9876500001", role: "PATIENT" });
    expect(status).toBe(200);
    expect(body.user.role).toBe("PATIENT");
    const user = await prisma.user.findUnique({ where: { email: "amit@test.local" }, include: { patient: true } });
    expect(user.patient).not.toBeNull();
    expect(getCookie("shds-auth-token")).toBeTruthy();
  });

  it("defaults to PATIENT when no role is sent", async () => {
    const { body } = await signup({ email: "norole@test.local" });
    expect(body.user.role).toBe("PATIENT");
  });

  it("rejects duplicate emails and short passwords", async () => {
    await signup({ email: "dup@test.local" });
    expect((await signup({ email: "dup@test.local" })).status).toBe(400);
    expect((await signup({ email: "short@test.local", password: "123" })).status).toBe(400);
  });

  it("makes the configured super admin email a SUPER_ADMIN without a code", async () => {
    const { body } = await signup({ email: process.env.SUPER_ADMIN_EMAIL });
    expect(body.user.role).toBe("SUPER_ADMIN");
  });
});

describe("staff sign-up requires a valid registration code (checked on the server)", () => {
  it.each(["ADMIN", "DOCTOR", "RECEPTIONIST", "SUPER_ADMIN"])("rejects role %s without a code", async (role) => {
    const { status, body } = await signup({ email: `hack-${role}@test.local`, role });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(await prisma.user.findUnique({ where: { email: `hack-${role}@test.local` } })).toBeNull();
  });

  it("rejects a made-up code id", async () => {
    const { status } = await signup({ email: "fake@test.local", role: "ADMIN", registrationCodeId: "not-a-real-id" });
    expect(status).toBe(400);
  });

  it("accepts a valid code, assigns the role and marks the code as used by that user", async () => {
    const code = await issueCode("RECEPTIONIST");
    const { status, body } = await signup({ email: "priya@test.local", role: "RECEPTIONIST", registrationCodeId: code.id });
    expect(status).toBe(200);
    expect(body.user.role).toBe("RECEPTIONIST");
    const used = await prisma.registrationCode.findUnique({ where: { id: code.id } });
    expect(used.status).toBe("USED");
    expect(used.usedById).toBe(body.user.id);
  });

  it("accepts a code typed in lower case or without dashes, for nurses and ward attendants too", async () => {
    for (const role of ["NURSE", "WARD_ATTENDANT"]) {
      const code = await issueCode(role);
      const typed = code.code.toLowerCase().replace(/-/g, " ");
      expect(await verifyRegistrationCode(typed, role)).toMatchObject({ valid: true, codeId: code.id, role });
    }
  });

  it("does not allow the same code to be used twice", async () => {
    const code = await issueCode("ADMIN");
    expect((await signup({ email: "first@test.local", role: "ADMIN", registrationCodeId: code.id })).status).toBe(200);
    const second = await signup({ email: "second@test.local", role: "ADMIN", registrationCodeId: code.id });
    expect(second.status).toBe(400);
    expect((await verifyRegistrationCode(code.code, "ADMIN")).valid).toBe(false);
  });

  it("rejects a code issued for a different role", async () => {
    const code = await issueCode("RECEPTIONIST");
    expect((await signup({ email: "x@test.local", role: "ADMIN", registrationCodeId: code.id })).status).toBe(400);
  });

  it("rejects an expired code", async () => {
    const code = await issueCode("RECEPTIONIST");
    await prisma.registrationCode.update({ where: { id: code.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await signup({ email: "late@test.local", role: "RECEPTIONIST", registrationCodeId: code.id })).status).toBe(400);
  });

  it("rejects a revoked code", async () => {
    const code = await issueCode("RECEPTIONIST");
    await prisma.registrationCode.update({ where: { id: code.id }, data: { status: "REVOKED" } });
    expect((await signup({ email: "rev@test.local", role: "RECEPTIONIST", registrationCodeId: code.id })).status).toBe(400);
  });

  it("gives a doctor who signs up with a code a doctor profile in the code's department", async () => {
    const dept = await createDepartment("Cardiology");
    const code = await issueCode("DOCTOR", dept.id);
    const { status, body } = await signup({ email: "rahul@test.local", phone: "9000000003", role: "DOCTOR", registrationCodeId: code.id });
    expect(status).toBe(200);
    const doctor = await prisma.doctor.findUnique({ where: { userId: body.user.id } });
    expect(doctor).not.toBeNull();
    expect(doctor.departmentId).toBe(dept.id);
  });
});

describe("generating registration codes", () => {
  it("requires a department for doctor codes", async () => {
    const admin = await createUser({ role: "ADMIN" });
    await loginAs(admin);
    const r = await generateRegistrationCode({ role: "DOCTOR", departmentId: null });
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/department/i);
  });

  it("is limited to administrators", async () => {
    for (const role of ["DOCTOR", "RECEPTIONIST", "PATIENT"]) {
      await loginAs(await createUser({ role }));
      expect((await generateRegistrationCode({ role: "ADMIN" })).success).toBe(false);
    }
  });
});

describe("login", () => {
  it("logs in with the right password and rejects the wrong one", async () => {
    await createUser({ role: "DOCTOR", email: "doc@test.local" });
    const ok = await readJson(await login(jsonRequest("/api/auth/login", { email: "doc@test.local", password: PASSWORD })));
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe("DOCTOR");
    expect(ok.body.user).not.toHaveProperty("password");
    const bad = await readJson(await login(jsonRequest("/api/auth/login", { email: "doc@test.local", password: "wrong" })));
    expect(bad.status).toBe(401);
  });

  it("is case-insensitive on email", async () => {
    await createUser({ email: "mixed@test.local" });
    const r = await login(jsonRequest("/api/auth/login", { email: "MIXED@Test.Local", password: PASSWORD }));
    expect(r.status).toBe(200);
  });
});
