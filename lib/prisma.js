import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { platformExtension } from "@/lib/audit/extension";
import { txStorage } from "@/lib/audit/tx-context";

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

/**
 * Run a multi-step write as one database transaction, the way `prisma.$transaction` does, but also
 * make `tx` the client the audit extension writes to (lib/audit/extension.js): every audit row and
 * sequence number taken inside `fn` joins the same transaction, so they roll back together with a
 * failure instead of an audit row surviving a write that didn't happen. Use this instead of calling
 * `prisma.$transaction(async (tx) => ...)` directly for any action with more than one write.
 */
export async function withTransaction(fn, options) {
  return prisma.$transaction((tx) => txStorage.run(tx, () => fn(tx)), options);
}
