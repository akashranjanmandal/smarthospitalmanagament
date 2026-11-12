"use server";

import { prisma, withTransaction } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { createAndStoreOtp, consumeOtp } from "@/lib/auth/otp";
import { signScopedToken, verifyScopedToken } from "@/lib/auth/jwt";
import { issueToken } from "@/lib/queue";
import { istDayRange } from "@/lib/dates";

// The kiosk device is signed in as a KIOSK account. A patient proves who they are with an OTP and the
// kiosk then holds a 10-minute ticket for that patient only — it never signs into the patient's account.
const TICKET_TTL = "10m";
const SESSION_ENDED = "Your session has ended. Please start again.";
const GENDERS = ["MALE", "FEMALE", "OTHER"];

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "This kiosk is signed out. Please call the front desk." };
  if (error.message === "Forbidden") return { success: false, message: "This screen only works on a kiosk device" };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const ticketFor = (kioskId, phone, patientId) => signScopedToken({ purpose: "kiosk", kioskId, phone, patientId }, TICKET_TTL);

async function readTicket(ticket, kioskId) {
  const t = await verifyScopedToken(ticket, "kiosk");
  return t && t.kioskId === kioskId ? t : null;
}

const doctorName = (d) => `Dr. ${d.user.firstName ?? ""} ${d.user.lastName ?? ""}`.trim();
const publicPatient = (p) => (p ? { id: p.id, firstName: p.firstName, lastName: p.lastName, uhid: p.uhid } : null);

async function todaysAppointments(patientId) {
  if (!patientId) return [];
  const { start, end } = istDayRange();
  const rows = await prisma.appointment.findMany({
    where: { patientId, appointmentDate: { gte: start, lt: end }, status: "SCHEDULED" },
    select: { id: true, appointmentTime: true, tokenNumber: true, doctor: { select: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } } },
    orderBy: { appointmentTime: "asc" },
  });
  return rows.map((a) => ({ id: a.id, time: a.appointmentTime, tokenNumber: a.tokenNumber, doctor: doctorName(a.doctor), department: a.doctor.department?.name ?? "" }));
}

export async function kioskSendOtp(phone) {
  try {
    await guardAction("kiosk", "create");
    const res = await createAndStoreOtp(phone);
    if (!res.success) return res;
    return { success: true, message: "We have sent a 6-digit code to your mobile", ...(res.devCode ? { devCode: res.devCode } : {}) };
  } catch (error) {
    return failed(error, "Could not send the code");
  }
}

export async function kioskVerify(phone, otp) {
  try {
    const { user } = await guardAction("kiosk", "read");
    const check = await consumeOtp(phone, otp);
    if (!check.success) return { success: false, message: "That code is not correct or has expired" };
    const patient = await prisma.patient.findFirst({
      where: { OR: [{ user: { phone: check.phone } }, { phone: check.phone }] },
      select: { id: true, uhid: true, firstName: true, lastName: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      success: true,
      data: { ticket: await ticketFor(user.id, check.phone, patient?.id ?? null), patient: publicPatient(patient), appointments: await todaysAppointments(patient?.id) },
    };
  } catch (error) {
    return failed(error, "Could not verify the code");
  }
}

export async function kioskRegister(ticket, data = {}) {
  try {
    const { user: kiosk } = await guardAction("kiosk", "create");
    const t = await readTicket(ticket, kiosk.id);
    if (!t) return { success: false, message: SESSION_ENDED };
    if (t.patientId) return { success: false, message: "You are already registered" };

    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim() || "";
    if (!firstName) return { success: false, message: "Enter your first name" };
    if (!GENDERS.includes(data.gender)) return { success: false, message: "Select your gender" };
    const dob = new Date(data.dateOfBirth);
    if (!data.dateOfBirth || Number.isNaN(dob.getTime()) || dob > new Date()) return { success: false, message: "Enter your date of birth" };

    const existing = await prisma.user.findFirst({ where: { phone: t.phone }, select: { id: true, role: true } });
    if (existing && existing.role !== "PATIENT") {
      return { success: false, message: "This mobile number belongs to a staff account. Please visit the front desk." };
    }

    const patient = await withTransaction(async (tx) => {
      const account = existing ?? await tx.user.create({
        data: { phone: t.phone, phoneVerified: true, email: `${t.phone}@phone.local`, role: "PATIENT", firstName, lastName, profileComplete: true },
      });
      return tx.patient.create({
        data: { userId: account.id, firstName, lastName, gender: data.gender, dateOfBirth: dob, phone: t.phone },
        select: { id: true, uhid: true, firstName: true, lastName: true },
      });
    });

    revalidatePath("/patients");
    return { success: true, message: `Welcome, ${firstName}. Your UHID is ${patient.uhid}`, data: { ticket: await ticketFor(kiosk.id, t.phone, patient.id), patient: publicPatient(patient) } };
  } catch (error) {
    return failed(error, "Could not complete registration");
  }
}

export async function kioskCheckIn(ticket, appointmentId) {
  try {
    const { user: kiosk } = await guardAction("kiosk", "update");
    const t = await readTicket(ticket, kiosk.id);
    if (!t?.patientId) return { success: false, message: SESSION_ENDED };

    const res = await issueToken(appointmentId, { patientId: t.patientId });
    if (!res.ok) return { success: false, message: res.message };
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { doctor: { select: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } } },
    });
    revalidatePath("/queue");
    return { success: true, message: `Your token is ${res.tokenNumber}`, data: { tokenNumber: res.tokenNumber, doctor: doctorName(appt.doctor), department: appt.doctor.department?.name ?? "" } };
  } catch (error) {
    return failed(error, "Could not check you in");
  }
}

/** Walk-in without an appointment: book now with the chosen doctor and issue a token straight away. */
export async function kioskWalkIn(ticket, { doctorId } = {}) {
  try {
    const { user: kiosk } = await guardAction("kiosk", "create");
    const t = await readTicket(ticket, kiosk.id);
    if (!t) return { success: false, message: SESSION_ENDED };
    if (!t.patientId) return { success: false, message: "Please register first" };

    const doctor = doctorId
      ? await prisma.doctor.findFirst({ where: { id: doctorId, available: true }, select: { id: true, user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } })
      : null;
    if (!doctor) return { success: false, message: "Choose a doctor" };

    // Reuse today's appointment with this doctor if the patient already has one.
    const { start, end } = istDayRange();
    let appt = await prisma.appointment.findFirst({
      where: { patientId: t.patientId, doctorId: doctor.id, appointmentDate: { gte: start, lt: end }, status: "SCHEDULED" },
      select: { id: true },
    });
    if (!appt) {
      const time = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
      appt = await prisma.appointment.create({
        data: { patientId: t.patientId, doctorId: doctor.id, appointmentDate: start, appointmentTime: time, reason: "Walk-in (kiosk)" },
        select: { id: true },
      });
    }
    const res = await issueToken(appt.id, { patientId: t.patientId });
    if (!res.ok && !res.tokenNumber) return { success: false, message: res.message };
    revalidatePath("/queue");
    revalidatePath("/appointments");
    return { success: true, message: `Your token is ${res.tokenNumber}`, data: { tokenNumber: res.tokenNumber, doctor: doctorName(doctor), department: doctor.department?.name ?? "" } };
  } catch (error) {
    return failed(error, "Could not book your visit");
  }
}

export async function kioskOptions() {
  try {
    await guardAction("kiosk", "read");
    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE", doctors: { some: { available: true } } },
      select: { id: true, name: true, doctors: { where: { available: true }, select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { name: "asc" },
    });
    return {
      success: true,
      data: { departments: departments.map((d) => ({ id: d.id, name: d.name, doctors: d.doctors.map((doc) => ({ id: doc.id, name: doctorName(doc), specialization: doc.specialization })) })) },
    };
  } catch (error) {
    return failed(error, "Could not load departments");
  }
}
