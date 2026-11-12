import { getCurrentUser, ensureUser } from "@/lib/auth";
import { canCreate, canRead, canUpdate, canDelete } from "@/lib/permissions";

export async function guardPage(module, action = "read") {
  let user;
  try {
    user = await ensureUser();
  } catch (error) {
    console.error("guardPage auth error:", error.message || error);
    return { authorized: false, error: "Service temporarily unavailable", status: 503 };
  }

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const role = user.role;

  if (action === "read" && !canRead(module, role)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }
  if (action === "create" && !canCreate(module, role)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }
  if (action === "update" && !canUpdate(module, role)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }
  if (action === "delete" && !canDelete(module, role)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true, user, role };
}

export async function guardAction(module, action = "read") {
  let user;
  try {
    user = await ensureUser();
  } catch (error) {
    console.error("guardAction auth error:", error.message || error);
    throw new Error("Service temporarily unavailable");
  }

  if (!user) {
    throw new Error("Unauthorized");
  }

  const role = user.role;

  if (action === "create" && !canCreate(module, role)) {
    throw new Error("Forbidden");
  }
  if (action === "read" && !canRead(module, role)) {
    throw new Error("Forbidden");
  }
  if (action === "update" && !canUpdate(module, role)) {
    throw new Error("Forbidden");
  }
  if (action === "delete" && !canDelete(module, role)) {
    throw new Error("Forbidden");
  }

  return { user, role };
}

export function isOwner(recordUserId, currentUserId) {
  return recordUserId === currentUserId;
}
