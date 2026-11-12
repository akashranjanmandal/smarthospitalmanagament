import { ROLES } from "@/lib/roles";

/**
 * Chain-wide roles (today: SUPER_ADMIN) see every branch; everyone else is scoped to the one
 * branch their account belongs to. Patients are never branch-scoped — their UHID and records
 * follow them to any branch (module M15), so this is only meaningful for staff.
 */
export function isChainWide(role) {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * The `where` fragment to add to a branch-scoped query: `{}` for a chain-wide role (no filter,
 * sees every branch), or `{ [field]: user.branchId }` for everyone else. A branch-scoped user
 * with no branchId (shouldn't happen for staff, but data can be messy) sees nothing, rather than
 * silently falling through to see everything.
 */
export function branchScope(user, field = "branchId") {
  if (isChainWide(user.role)) return {};
  return { [field]: user.branchId ?? "__no_branch__" };
}

/** The branchId a new branch-scoped record should get: the signed-in admin's own branch, or,
 * for a chain-wide role, whatever branch they explicitly chose (required in that case). */
export function resolveBranchId(user, requestedBranchId) {
  if (isChainWide(user.role)) {
    return requestedBranchId ? { ok: true, branchId: requestedBranchId } : { ok: false, message: "Select a branch" };
  }
  return user.branchId ? { ok: true, branchId: user.branchId } : { ok: false, message: "Your account is not assigned to a branch" };
}
