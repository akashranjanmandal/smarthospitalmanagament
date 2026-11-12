"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { branchScope, isChainWide } from "@/lib/branch-scope";
import { istDateString } from "@/lib/dates";
import { ROSTERABLE_ROLES, assignedWardIds } from "@/lib/roster";

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to manage the roster" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(fallback, error);
  return { success: false, message: fallback };
}

const dayStart = (dateString) => new Date(`${dateString}T00:00:00.000Z`);

/** Wards this admin can roster against: their own branch, unless chain-wide. */
export async function getWardsForRoster() {
  try {
    const { user } = await guardAction("roster", "update");
    const wards = await prisma.ward.findMany({ where: branchScope(user), select: { id: true, name: true, floor: true }, orderBy: { name: "asc" } });
    return { success: true, data: wards };
  } catch (error) {
    return failed(error, "Failed to load wards");
  }
}

/** Nurses and ward attendants this admin can roster: their own branch, unless chain-wide. */
export async function getRosterableStaff() {
  try {
    const { user } = await guardAction("roster", "update");
    const staff = await prisma.user.findMany({
      where: { role: { in: ROSTERABLE_ROLES }, ...branchScope(user) },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: { firstName: "asc" },
    });
    return { success: true, data: staff };
  } catch (error) {
    return failed(error, "Failed to load staff");
  }
}

/** The roster for one ward on one date, both shifts. */
export async function getWardRoster(wardId, date = istDateString()) {
  try {
    const { user, role } = await guardAction("roster", "read");
    const ward = await prisma.ward.findUnique({ where: { id: wardId }, select: { branchId: true } });
    if (!ward || (!isChainWide(role) && ward.branchId !== user.branchId)) return { success: false, message: "Ward not found" };

    const rows = await prisma.wardAssignment.findMany({
      where: { wardId, date: dayStart(date) },
      orderBy: { shift: "asc" },
    });
    const staffIds = [...new Set(rows.map((r) => r.userId))];
    const staff = await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true, role: true } });
    const byId = Object.fromEntries(staff.map((s) => [s.id, s]));
    return { success: true, data: rows.map((r) => ({ ...r, staff: byId[r.userId] ?? null })) };
  } catch (error) {
    return failed(error, "Failed to load roster");
  }
}

/** Assign a nurse or ward attendant to a ward for a shift on a date. */
export async function assignToWard(data) {
  try {
    const { user, role } = await guardAction("roster", "create");
    if (!data.userId || !data.wardId) return { success: false, message: "Select a staff member and a ward" };
    const date = data.date || istDateString();

    const [staff, ward] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.userId }, select: { role: true, branchId: true } }),
      prisma.ward.findUnique({ where: { id: data.wardId }, select: { branchId: true } }),
    ]);
    if (!staff || !ROSTERABLE_ROLES.includes(staff.role)) return { success: false, message: "Only nurses and ward attendants can be rostered" };
    if (!ward) return { success: false, message: "Ward not found" };
    if (!isChainWide(role) && ward.branchId !== user.branchId) return { success: false, message: "That ward is not in your branch" };
    if (staff.branchId !== ward.branchId) return { success: false, message: "That staff member is not in this ward's branch" };

    const assignment = await prisma.wardAssignment.create({
      data: { userId: data.userId, wardId: data.wardId, date: dayStart(date), shift: data.shift || "DAY", createdById: user.id },
    });

    revalidatePath("/admin/roster");
    return { success: true, message: "Shift assigned", data: assignment };
  } catch (error) {
    if (error.code === "P2002") return { success: false, message: "Already assigned to this ward and shift on this date" };
    return failed(error, "Failed to assign shift");
  }
}

export async function removeAssignment(id) {
  try {
    const { user, role } = await guardAction("roster", "delete");
    const existing = await prisma.wardAssignment.findUnique({ where: { id } });
    if (!existing) return { success: false, message: "Assignment not found" };
    if (!isChainWide(role)) {
      const ward = await prisma.ward.findUnique({ where: { id: existing.wardId }, select: { branchId: true } });
      if (!ward || ward.branchId !== user.branchId) return { success: false, message: "Assignment not found" };
    }
    await prisma.wardAssignment.delete({ where: { id } });
    revalidatePath("/admin/roster");
    return { success: true, message: "Shift removed" };
  } catch (error) {
    return failed(error, "Failed to remove shift");
  }
}

/** The signed-in nurse/ward attendant's own wards for today (or a given date). */
export async function getMyWardsToday(date = istDateString()) {
  try {
    const { user, role } = await guardAction("roster", "read");
    if (!ROSTERABLE_ROLES.includes(role)) return { success: true, data: [] };
    const wardIds = await assignedWardIds(user.id, date);
    if (wardIds.length === 0) return { success: true, data: [] };
    const wards = await prisma.ward.findMany({ where: { id: { in: wardIds } }, select: { id: true, name: true, floor: true } });
    return { success: true, data: wards };
  } catch (error) {
    return failed(error, "Failed to load your wards");
  }
}
