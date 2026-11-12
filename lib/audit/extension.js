import { getAuthPayload } from "@/lib/auth/jwt";
import { formatUhid } from "@/lib/identifiers";
import { redact, changedFields } from "./format";

const SINGLE = { create: "CREATE", update: "UPDATE", delete: "DELETE", upsert: "UPSERT" };
const MANY = { createMany: "CREATE_MANY", updateMany: "UPDATE_MANY", deleteMany: "DELETE_MANY" };
const NOT_AUDITED = new Set(["AuditLog", "Sequence"]);

const delegate = (client, model) => client[model[0].toLowerCase() + model.slice(1)];
const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj?.[f] ?? null]));

/** Atomically take the next number of a named counter (UHID, admission numbers, ...). */
export async function nextSequence(client, name) {
  const rows = await client.$queryRaw`
    INSERT INTO "Sequence" ("name", "value") VALUES (${name}, 1)
    ON CONFLICT ("name") DO UPDATE SET "value" = "Sequence"."value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

/** The signed-in user making this request, or nobody (scripts, cron, sign-up). */
async function currentActor() {
  try {
    const payload = await getAuthPayload();
    return payload ? { actorId: payload.userId, actorRole: payload.role } : {};
  } catch {
    return {};
  }
}

export async function writeAudit(client, entry) {
  try {
    const actor = entry.actorId !== undefined ? {} : await currentActor();
    await client.auditLog.create({ data: { ...actor, ...entry, changes: entry.changes ? redact(entry.changes) : undefined } });
  } catch (error) {
    // The audit trail must never break the operation it describes.
    console.error("Audit log write failed:", error.message);
  }
}

/**
 * Prisma client extension: assigns UHIDs to new patients and writes an audit entry
 * for every create / update / delete made through the app.
 */
export function platformExtension(base) {
  return {
    name: "platform",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === "Patient" && operation === "create" && !args.data?.uhid) {
            args.data = { ...args.data, uhid: formatUhid(await nextSequence(base, "uhid")) };
          }
          if (NOT_AUDITED.has(model) || !(operation in SINGLE || operation in MANY)) return query(args);

          if (operation in MANY) {
            const result = await query(args);
            await writeAudit(base, { action: MANY[operation], entity: model, changes: { where: args.where ?? null, count: result?.count ?? null } });
            return result;
          }

          const before = operation === "create" ? null : await delegate(base, model).findUnique({ where: args.where }).catch(() => null);
          const result = await query(args);
          const action = operation === "upsert" ? (before ? "UPDATE" : "CREATE") : SINGLE[operation];
          const entityId = result?.id ?? before?.id ?? args.where?.id ?? null;

          let changes;
          if (action === "CREATE") changes = { after: result };
          else if (action === "DELETE") changes = { before: before ?? result };
          else {
            // Use the write's own result: inside a transaction a fresh read would not see the change yet.
            const after = result && typeof result === "object" ? result : {};
            const shared = Object.keys(before || {}).filter((k) => k in after);
            const fields = changedFields(redact(pick(before, shared)), redact(pick(after, shared)));
            changes = { fields, before: pick(before, fields), after: pick(after, fields) };
          }
          await writeAudit(base, { action, entity: model, entityId, changes });
          return result;
        },
      },
    },
  };
}
