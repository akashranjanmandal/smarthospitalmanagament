import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { platformExtension } from "@/lib/audit/extension";

const globalForPrisma = globalThis;

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // Never load password hashes unless a query opts in with `omit: { password: false }`,
  // so they can't leak through `include: { user: true }` into pages and action results.
  const base = new PrismaClient({ adapter, omit: { user: { password: true } } });
  // UHIDs for new patients and an audit entry for every write (see lib/audit/extension.js)
  return base.$extends(platformExtension(base));
}

export const prisma = globalForPrisma.prisma || getPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
