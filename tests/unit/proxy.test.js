import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

process.env.JWT_SECRET = "unit-test-secret";

let proxy;
let signToken;
beforeAll(async () => {
  ({ proxy } = await import("@/proxy"));
  ({ signToken } = await import("@/lib/auth/jwt"));
});

async function request(path, role, { profileComplete = true } = {}) {
  const headers = {};
  if (role) {
    const token = await signToken({ userId: "u1", email: "u@test.local", role, profileComplete });
    headers.cookie = `shds-auth-token=${token}`;
  }
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
}

const location = (res) => res.headers.get("location") && new URL(res.headers.get("location")).pathname;
const passesThrough = (res) => res.headers.get("x-middleware-next") === "1";

describe("proxy", () => {
  it("redirects signed-out visitors to sign-in", async () => {
    const res = await request("/dashboard");
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/sign-in");
  });

  it("lets public pages through", async () => {
    expect(passesThrough(await request("/sign-in"))).toBe(true);
    expect(passesThrough(await request("/api/auth/login"))).toBe(true);
  });

  it("lets the escalation cron reach its route (the route checks the secret itself)", async () => {
    expect(passesThrough(await request("/api/cron/escalate"))).toBe(true);
  });

  it("sends patients with incomplete profiles to onboarding", async () => {
    const res = await request("/appointments", "PATIENT", { profileComplete: false });
    expect(location(res)).toBe("/complete-profile");
  });

  it("sends users to /forbidden for pages their role cannot use", async () => {
    expect(location(await request("/admin/registration-codes", "PATIENT"))).toBe("/forbidden");
    expect(location(await request("/billing", "DOCTOR"))).toBe("/forbidden");
    expect(location(await request("/medical-records/new", "RECEPTIONIST"))).toBe("/forbidden");
  });

  it("lets users open pages their role can use", async () => {
    expect(passesThrough(await request("/admin/registration-codes", "ADMIN"))).toBe(true);
    expect(passesThrough(await request("/medical-records/new", "DOCTOR"))).toBe(true);
    expect(passesThrough(await request("/appointments/new", "PATIENT"))).toBe(true);
    expect(passesThrough(await request("/dashboard", "PATIENT"))).toBe(true);
  });

  it("starts the website at sign-in — there is no public landing page", async () => {
    expect(location(await request("/"))).toBe("/sign-in");
  });

  it("takes signed-in users from the root and the sign-in pages straight to their dashboard", async () => {
    expect(location(await request("/", "NURSE"))).toBe("/dashboard");
    expect(location(await request("/sign-in", "DOCTOR"))).toBe("/dashboard");
    expect(location(await request("/sign-up", "PATIENT"))).toBe("/dashboard");
  });

  it("still lets signed-in users reach password reset", async () => {
    expect(passesThrough(await request("/reset-password", "PATIENT"))).toBe(true);
  });

  it("keeps a kiosk device on the kiosk screen", async () => {
    expect(location(await request("/", "KIOSK"))).toBe("/kiosk");
    expect(location(await request("/sign-in", "KIOSK"))).toBe("/kiosk");
    expect(location(await request("/dashboard", "KIOSK"))).toBe("/kiosk");
    expect(location(await request("/patients", "KIOSK"))).toBe("/kiosk");
    expect(passesThrough(await request("/kiosk", "KIOSK"))).toBe(true);
  });

  it("does not let staff open the kiosk screen", async () => {
    expect(location(await request("/kiosk", "RECEPTIONIST"))).toBe("/forbidden");
  });

  it("treats a short-lived kiosk ticket as no session at all", async () => {
    const { signScopedToken } = await import("@/lib/auth/jwt");
    const ticket = await signScopedToken({ purpose: "kiosk", phone: "9123456780" }, "10m");
    const res = await proxy(new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: `shds-auth-token=${ticket}` } }));
    expect(location(res)).toBe("/sign-in");
  });

  it("starts the insurance desk on its worklist", async () => {
    expect(location(await request("/", "INSURANCE_DESK"))).toBe("/insurance");
    expect(location(await request("/sign-in", "INSURANCE_DESK"))).toBe("/insurance");
    expect(location(await request("/dashboard", "INSURANCE_DESK"))).toBe("/insurance");
  });

  it("starts pharmacists on the pharmacy queue", async () => {
    expect(location(await request("/dashboard", "PHARMACIST"))).toBe("/pharmacy");
  });

  it("starts lab technicians on the lab worklist and keeps patients out of it", async () => {
    expect(location(await request("/dashboard", "LAB_TECH"))).toBe("/lab");
    expect(location(await request("/lab", "PATIENT"))).toBe("/forbidden");
    expect(passesThrough(await request("/lab-reports", "PATIENT"))).toBe(true);
    expect(location(await request("/lab/tests", "LAB_TECH"))).toBe("/forbidden");
  });

  it("starts kitchen staff on the meal lists", async () => {
    expect(location(await request("/dashboard", "KITCHEN"))).toBe("/kitchen");
  });
});
