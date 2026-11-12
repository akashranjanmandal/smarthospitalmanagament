import { AsyncLocalStorage } from "node:async_hooks";

// Tracks which Prisma client (the base client, or an interactive-transaction's `tx`) is
// "current" for the running request, so the audit extension can join whatever transaction
// the application code is already inside instead of writing on a separate connection that
// would survive a rollback. Set only by `withTransaction` in lib/prisma.js.
export const txStorage = new AsyncLocalStorage();
