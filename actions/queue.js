"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { issueToken } from "@/lib/queue";
import { istDateString, istDayRange, maskName } from "@/lib/dates";

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const todayWhere = () => {
  const { start, end } = istDayRange();
  return { appointmentDate: { gte: start, lt: end } };
};

async function ownDoctorId(user) {
  const doctor = user.doctor ?? (await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true } }));
  return doctor?.id ?? null;
}

function refresh() {
  revalidatePath("/queue");
  revalidatePath("/appointments");
}

/** Front desk: mark today's patient as arrived and issue the next token for their doctor. */
export async function checkInAppointment(appointmentId) {
  try {
    await guardAction("queue", "update");
    const res = await issueToken(appointmentId);
    if (!res.ok) return { success: false, message: res.message };
    refresh();
    return { success: true, message: `${res.patientName} checked in — token ${res.tokenNumber}`, data: { tokenNumber: res.tokenNumber } };
  } catch (error) {
    return failed(error, "Failed to check in");
  }
}

/** Doctor: call the lowest waiting token into the consultation room. */
export async function callNextPatient({ doctorId } = {}) {
  try {
    const { user, role } = await guardAction("queue", "update");
    const forDoctor = role === "DOCTOR" ? await ownDoctorId(user) : doctorId;
    if (!forDoctor) return { success: false, message: "Choose the doctor whose queue to call" };

    const base = { ...todayWhere(), doctorId: forDoctor, status: "SCHEDULED", tokenNumber: { not: null } };
    const current = await prisma.appointment.findFirst({ where: { ...base, consultStartedAt: { not: null } }, select: { tokenNumber: true } });
    if (current) return { success: false, message: `Finish token ${current.tokenNumber} before calling the next patient` };

    const next = await prisma.appointment.findFirst({
      where: { ...base, consultStartedAt: null },
      orderBy: { tokenNumber: "asc" },
      select: { id: true, tokenNumber: true, patient: { select: { firstName: true, lastName: true } } },
    });
    if (!next) return { success: false, message: "No patients are waiting" };

    await prisma.appointment.update({ where: { id: next.id }, data: { consultStartedAt: new Date() } });
    refresh();
    const patientName = `${next.patient.firstName} ${next.patient.lastName}`.trim();
    return { success: true, message: `Token ${next.tokenNumber} — ${patientName}, please come in`, data: { appointmentId: next.id, tokenNumber: next.tokenNumber, patientName } };
  } catch (error) {
    return failed(error, "Failed to call the next patient");
  }
}

/** Today's queue per doctor: now serving, waiting (token order), not yet arrived, seen. */
export async function getQueue({ doctorId } = {}) {
  try {
    const { user, role } = await guardAction("queue", "read");
    const only = role === "DOCTOR" ? await ownDoctorId(user) : doctorId && doctorId !== "all" ? doctorId : null;

    const appts = await prisma.appointment.findMany({
      where: { ...todayWhere(), status: { not: "CANCELLED" }, ...(only ? { doctorId: only } : {}) },
      select: {
        id: true, appointmentTime: true, status: true, tokenNumber: true, checkedInAt: true, consultStartedAt: true, reason: true,
        patient: { select: { id: true, uhid: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
        doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
      },
      orderBy: [{ appointmentTime: "asc" }],
    });

    const byDoctor = new Map();
    for (const a of appts) {
      const key = a.doctor.id;
      if (!byDoctor.has(key)) {
        byDoctor.set(key, {
          doctorId: key,
          doctor: `Dr. ${a.doctor.user.firstName ?? ""} ${a.doctor.user.lastName ?? ""}`.trim(),
          department: a.doctor.department?.name ?? "",
          nowServing: null,
          waiting: [],
          notArrived: [],
          seen: 0,
        });
      }
      const d = byDoctor.get(key);
      const row = { id: a.id, appointmentTime: a.appointmentTime, tokenNumber: a.tokenNumber, checkedInAt: a.checkedInAt, consultStartedAt: a.consultStartedAt, reason: a.reason, patient: a.patient };
      if (a.status === "COMPLETED") d.seen += 1;
      else if (a.consultStartedAt) d.nowServing = row;
      else if (a.tokenNumber) d.waiting.push(row);
      else d.notArrived.push(row);
    }
    for (const d of byDoctor.values()) d.waiting.sort((x, y) => x.tokenNumber - y.tokenNumber);

    return { success: true, data: { date: istDateString(), doctors: [...byDoctor.values()].sort((x, y) => x.doctor.localeCompare(y.doctor)) } };
  } catch (error) {
    return failed(error, "Failed to load the queue");
  }
}

/** Waiting-room TV: tokens and masked names only — no phone numbers or IDs. */
export async function getQueueDisplay() {
  const res = await getQueue({});
  if (!res.success) return res;
  const mask = (row) => ({ token: row.tokenNumber, name: maskName(row.patient.firstName, row.patient.lastName) });
  return {
    success: true,
    data: res.data.doctors
      .filter((d) => d.nowServing || d.waiting.length)
      .map((d) => ({ doctor: d.doctor, department: d.department, nowServing: d.nowServing ? mask(d.nowServing) : null, next: d.waiting.slice(0, 5).map(mask) })),
  };
}
