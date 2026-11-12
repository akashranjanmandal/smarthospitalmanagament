"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { isChainWide } from "@/lib/branch-scope";
import { istDayRange } from "@/lib/dates";

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(fallback, error);
  return { success: false, message: fallback };
}

const STAFF_NAME = { select: { id: true, firstName: true, lastName: true, role: true } };
// No procedure has a stored duration, so a conflict is "another live booking for this theatre or
// this surgeon within N hours of the requested time" — a deliberately generous heuristic rather
// than exact overlap, since most procedures run well under this window.
const OT_BUFFER_MS = 3 * 60 * 60 * 1000;
const LIVE_OT_STATUSES = ["SCHEDULED", "IN_PROGRESS"];

/** Admitted patients and available doctors, for the schedule form. */
export async function getSchedulableOptions() {
  try {
    const { user, role } = await guardAction("ot", "create");
    const branch = isChainWide(role) ? {} : { branchId: user.branchId };
    const [admissions, doctors] = await Promise.all([
      prisma.admission.findMany({
        where: { status: "ADMITTED", ...branch },
        select: { id: true, admissionNumber: true, patient: { select: { firstName: true, lastName: true, uhid: true } }, bed: { select: { bedNumber: true } } },
        orderBy: { admittedAt: "desc" },
      }),
      prisma.doctor.findMany({
        where: { available: true, department: branch },
        select: { id: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { firstName: "asc" } },
      }),
    ]);
    return { success: true, data: { admissions, doctors: doctors.map(({ user: u, ...d }) => ({ ...d, firstName: u.firstName, lastName: u.lastName })) } };
  } catch (error) {
    return failed(error, "Failed to load options");
  }
}

/** Book a procedure for a currently-admitted patient. */
export async function scheduleOT(data) {
  try {
    const { user, role } = await guardAction("ot", "create");
    const procedureName = data.procedureName?.trim();
    const theatre = data.theatre?.trim();
    if (!procedureName) return { success: false, message: "Enter the procedure name" };
    if (!theatre) return { success: false, message: "Enter the theatre" };
    if (!data.scheduledAt) return { success: false, message: "Choose the date and time" };
    if (!data.surgeonId) return { success: false, message: "Select the surgeon" };

    const [admission, surgeon] = await Promise.all([
      prisma.admission.findUnique({ where: { id: data.admissionId }, select: { id: true, status: true, branchId: true } }),
      prisma.doctor.findUnique({ where: { id: data.surgeonId }, select: { id: true, department: { select: { branchId: true } } } }),
    ]);
    if (!admission || admission.status !== "ADMITTED") return { success: false, message: "This patient is not currently admitted" };
    if (!isChainWide(role) && admission.branchId !== user.branchId) return { success: false, message: "Admission not found" };
    if (!surgeon) return { success: false, message: "Surgeon not found" };
    if (surgeon.department.branchId !== admission.branchId) return { success: false, message: "That surgeon is not in this branch" };

    const scheduledAt = new Date(data.scheduledAt);
    const windowStart = new Date(scheduledAt.getTime() - OT_BUFFER_MS);
    const windowEnd = new Date(scheduledAt.getTime() + OT_BUFFER_MS);
    const conflict = await prisma.oTBooking.findFirst({
      where: {
        status: { in: LIVE_OT_STATUSES },
        scheduledAt: { gte: windowStart, lte: windowEnd },
        OR: [{ theatre }, { surgeonId: data.surgeonId }],
      },
      select: { theatre: true, surgeonId: true, scheduledAt: true },
    });
    if (conflict) {
      const what = conflict.theatre === theatre ? `Theatre ${theatre}` : "That surgeon";
      return { success: false, message: `${what} already has a procedure booked around that time` };
    }

    const booking = await prisma.oTBooking.create({
      data: {
        admissionId: admission.id,
        procedureName,
        surgeonId: data.surgeonId,
        theatre,
        scheduledAt,
        notes: data.notes?.trim() || null,
        createdById: user.id,
      },
    });

    revalidatePath("/ot");
    return { success: true, message: "Procedure scheduled", data: booking };
  } catch (error) {
    return failed(error, "Failed to schedule the procedure");
  }
}

/** The OT board for a date (today by default): every booking in the signed-in staff's branch. */
export async function getOTSchedule({ date } = {}) {
  try {
    const { user, role } = await guardAction("ot", "read");
    const { start, end } = istDayRange(date);

    const bookings = await prisma.oTBooking.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        ...(isChainWide(role) ? {} : { admission: { branchId: user.branchId } }),
      },
      include: {
        admission: { select: { admissionNumber: true, patient: { select: { firstName: true, lastName: true, uhid: true } } } },
        surgeon: { select: { user: STAFF_NAME } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    return { success: true, data: bookings };
  } catch (error) {
    return failed(error, "Failed to load the OT schedule");
  }
}

export async function getOTBooking(id) {
  try {
    const { user, role } = await guardAction("ot", "read");
    const booking = await prisma.oTBooking.findUnique({
      where: { id },
      include: {
        admission: { select: { admissionNumber: true, branchId: true, patient: { select: { firstName: true, lastName: true, uhid: true, allergies: true } } } },
        surgeon: { select: { user: STAFF_NAME } },
      },
    });
    if (!booking || (!isChainWide(role) && booking.admission.branchId !== user.branchId)) {
      return { success: false, message: "Booking not found" };
    }
    const [signInBy, timeOutBy, signOutBy] = await Promise.all(
      [booking.signInById, booking.timeOutById, booking.signOutById].map((id) =>
        id ? prisma.user.findUnique({ where: { id }, select: STAFF_NAME.select }) : null
      )
    );
    return { success: true, data: { ...booking, signInBy, timeOutBy, signOutBy } };
  } catch (error) {
    return failed(error, "Failed to load the booking");
  }
}

async function checklistStep(id, { phase, stampField, byField, requirePrior, nextStatus }) {
  try {
    const { user, role } = await guardAction("ot", "update");
    const booking = await prisma.oTBooking.findUnique({ where: { id }, select: { status: true, admission: { select: { branchId: true } }, [requirePrior || "id"]: true } });
    if (!booking || (!isChainWide(role) && booking.admission.branchId !== user.branchId)) return { success: false, message: "Booking not found" };
    if (booking.status === "CANCELLED") return { success: false, message: "This procedure was cancelled" };
    if (booking.status === "COMPLETED") return { success: false, message: "This procedure is already complete" };
    if (requirePrior && !booking[requirePrior]) return { success: false, message: `Complete ${phase === "time-out" ? "sign-in" : "time-out"} first` };

    await prisma.oTBooking.update({
      where: { id },
      data: { [stampField]: new Date(), [byField]: user.id, status: nextStatus },
    });
    revalidatePath("/ot");
    revalidatePath(`/ot/${id}`);
    return { success: true, message: `${phase} recorded` };
  } catch (error) {
    return failed(error, `Failed to record ${phase}`);
  }
}

export async function recordSignIn(id) {
  return checklistStep(id, { phase: "Sign-in", stampField: "signInAt", byField: "signInById", nextStatus: "IN_PROGRESS" });
}
export async function recordTimeOut(id) {
  return checklistStep(id, { phase: "Time-out", stampField: "timeOutAt", byField: "timeOutById", requirePrior: "signInAt", nextStatus: "IN_PROGRESS" });
}
export async function recordSignOut(id) {
  return checklistStep(id, { phase: "Sign-out", stampField: "signOutAt", byField: "signOutById", requirePrior: "timeOutAt", nextStatus: "COMPLETED" });
}

export async function cancelOT(id, reason) {
  try {
    const { user, role } = await guardAction("ot", "update");
    if (!reason?.trim()) return { success: false, message: "Enter a reason for cancelling" };
    const booking = await prisma.oTBooking.findUnique({ where: { id }, select: { status: true, admission: { select: { branchId: true } } } });
    if (!booking || (!isChainWide(role) && booking.admission.branchId !== user.branchId)) return { success: false, message: "Booking not found" };
    if (booking.status === "COMPLETED") return { success: false, message: "A completed procedure cannot be cancelled" };
    if (booking.status === "CANCELLED") return { success: false, message: "Already cancelled" };

    await prisma.oTBooking.update({ where: { id }, data: { status: "CANCELLED", cancelReason: reason.trim() } });
    revalidatePath("/ot");
    return { success: true, message: "Procedure cancelled" };
  } catch (error) {
    return failed(error, "Failed to cancel the procedure");
  }
}
