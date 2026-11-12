import { vi, beforeEach, afterAll } from "vitest";

// Integration tests always run against a separate database so local data is never touched.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://localhost:5432/smart_hospital_test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.SUPER_ADMIN_EMAIL = "superadmin@test.local";
process.env.OTP_STATIC_CODE = "123456";
process.env.CRON_SECRET = "test-cron-secret";
delete process.env.RESEND_API_KEY;

// lib/prisma caches its client on globalThis; start each test file with a fresh one so the
// audit extension reads this file's mocked cookies, not the previous file's.
delete globalThis.prisma;

vi.mock("next/headers", async () => (await import("./cookie-jar.js")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { resetDb } = await import("./db.js");
const { clearCookies } = await import("./cookie-jar.js");

beforeEach(async () => {
  clearCookies();
  await resetDb();
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
