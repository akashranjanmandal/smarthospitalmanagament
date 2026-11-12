import { prisma } from "@/lib/prisma";
import { istDateString } from "@/lib/dates";

export const ROSTERABLE_ROLES = ["NURSE", "WARD_ATTENDANT"];

const dayStart = (dateString) => new Date(`${dateString}T00:00:00.000Z`);

/**
 * Which wards this user is rostered to today (or the given date), across both shifts. An empty
 * array means "no roster entry" — callers should treat that as unrestricted (see every ward in
 * the branch), not as "assigned to nothing", so that staff nobody has rostered yet aren't locked
 * out of the wards they're already covering.
 */
export async function assignedWardIds(userId, dateString = istDateString()) {
  const rows = await prisma.wardAssignment.findMany({
    where: { userId, date: dayStart(dateString) },
    select: { wardId: true },
  });
  return [...new Set(rows.map((r) => r.wardId))];
}
