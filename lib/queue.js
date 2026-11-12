import { prisma } from "@/lib/prisma";
import { nextSequence } from "@/lib/audit/extension";
import { istDateString } from "@/lib/dates";

/**
 * Check a patient in for today's appointment and issue the next token for that doctor.
 * Callers do their own permission checks (front desk via the queue module, kiosk via its ticket).
 */
export async function issueToken(appointmentId, where = {}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, ...where },
    select: { id: true, doctorId: true, status: true, appointmentDate: true, tokenNumber: true, patient: { select: { firstName: true, lastName: true } } },
  });
  if (!appt) return { ok: false, message: "Appointment not found" };
  if (appt.status === "CANCELLED") return { ok: false, message: "This appointment is cancelled" };
  if (appt.status === "COMPLETED") return { ok: false, message: "This appointment is already completed" };
  const today = istDateString();
  if (appt.appointmentDate.toISOString().slice(0, 10) !== today) return { ok: false, message: "Only today's appointments can be checked in" };
  if (appt.tokenNumber) return { ok: false, message: `Already checked in with token ${appt.tokenNumber}`, tokenNumber: appt.tokenNumber };

  const tokenNumber = await nextSequence(prisma, `token-${appt.doctorId}-${today}`);
  try {
    await prisma.appointment.update({ where: { id: appt.id, tokenNumber: null }, data: { tokenNumber, checkedInAt: new Date() } });
  } catch (error) {
    if (error.code === "P2025") return { ok: false, message: "This patient was just checked in by someone else" };
    throw error;
  }
  return { ok: true, tokenNumber, patientName: [appt.patient.firstName, appt.patient.lastName].filter(Boolean).join(" ") };
}
