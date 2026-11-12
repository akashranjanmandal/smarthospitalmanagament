const SECRET_KEYS = new Set(["password", "code", "token", "tokenHash"]);
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt"]);

// Make a record safe and JSON-friendly for the audit log.
export function redact(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.has(k) ? "[redacted]" : redact(v);
    return out;
  }
  return value;
}

export function changedFields(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((k) => !IGNORED_FIELDS.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}

const humanize = (entity) => entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const VERBS = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted", VIEW: "Viewed", CREATE_MANY: "Created several", UPDATE_MANY: "Updated several", DELETE_MANY: "Deleted several" };

export function describeAuditEntry({ action, entity, changes }) {
  if (action === "LOGIN") return "Signed in";
  if (action === "LOGIN_FAILED") return "Failed sign-in attempt";
  if (action === "LOGOUT") return "Signed out";
  const base = `${VERBS[action] || action} ${humanize(entity)}`;
  const fields = changes?.fields;
  return action === "UPDATE" && fields?.length ? `${base} (${fields.join(", ")})` : base;
}
