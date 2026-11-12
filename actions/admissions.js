"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { nextSequence } from "@/lib/audit/extension";
import { formatAdmissionNumber } from "@/lib/identifiers";
import { vitalFlags } from "@/lib/clinical/vitals";
import { BED_STATUS_LABELS } from "@/lib/constants";

const ADMITTABLE_BED = ["VACANT", "RESERVED"];
const DISCHARGE_CONDITIONS = ["RECOVERED", "IMPROVED", "STABLE", "REFERRED", "AGAINST_MEDICAL_ADVICE"];

const PATIENT_SUMMARY = { id: true, uhid: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, phone: true, bloodGroup: true, allergies: true };
const DOCTOR_NAME = { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } };
const STAFF_NAME = { select: { id: true, firstName: true, lastName: true, role: true } };

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

function refresh() {
  revalidatePath("/admissions");
  revalidatePath("/beds");
  revalidatePath("/handover");
  revalidatePath("/dashboard");
}

export async function getAdmitFormOptions() {
  try {
    await guardAction("admissions", "create");
    const [beds, patients, departments, doctors] = await Promise.all([
      prisma.bed.findMany({
        where: { status: { in: ADMITTABLE_BED } },
        select: { id: true, bedNumber: true, bedType: true, status: true, ward: { select: { id: true, name: true, floor: true, departmentId: true, genderWard: true } } },
        orderBy: [{ ward: { floor: "asc" } }, { ward: { name: "asc" } }, { bedNumber: "asc" }],
      }),
      prisma.patient.findMany({
        where: { admissions: { none: { status: "ADMITTED" } } },
        select: { id: true, uhid: true, firstName: true, lastName: true, phone: true, gender: true },
        orderBy: { firstName: "asc" },
        take: 500,
      }),
      prisma.department.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.doctor.findMany({
        where: { available: true },
        select: { id: true, departmentId: true, specialization: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { firstName: "asc" } },
      }),
    ]);
    return {
      success: true,
      data: {
        beds,
        patients,
        departments,
        doctors: doctors.map(({ user, ...d }) => ({ ...d, firstName: user.firstName, lastName: user.lastName })),
      },
    };
  } catch (error) {
    return failed(error, "Failed to load admission options");
  }
}

export async function admitPatient(data = {}) {
  try {
    const { user } = await guardAction("admissions", "create");

    if (!data.patientId) return { success: false, message: "Select the patient" };
    if (!data.bedId) return { success: false, message: "Select a bed" };
    const reason = data.reason?.trim();
    if (!reason) return { success: false, message: "Enter the reason for admission" };
    if (!data.departmentId) return { success: false, message: "Select the admitting department" };
    if (!data.doctorId) return { success: false, message: "Select the attending doctor" };

    const [patient, bed, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: data.patientId }, select: { id: true, firstName: true, lastName: true } }),
      prisma.bed.findUnique({ where: { id: data.bedId }, select: { id: true, bedNumber: true, status: true } }),
      prisma.doctor.findUnique({ where: { id: data.doctorId }, select: { departmentId: true } }),
    ]);
    if (!patient) return { success: false, message: "Patient not found" };
    if (!bed) return { success: false, message: "Bed not found" };
    if (!doctor || doctor.departmentId !== data.departmentId) {
      return { success: false, message: "The selected doctor is not in the selected department" };
    }
    if (!ADMITTABLE_BED.includes(bed.status)) {
      return { success: false, message: `Bed ${bed.bedNumber} is not available (${BED_STATUS_LABELS[bed.status]})` };
    }
    const current = await prisma.admission.findFirst({
      where: { patientId: patient.id, status: "ADMITTED" },
      select: { admissionNumber: true, bed: { select: { bedNumber: true } } },
    });
    if (current) {
      return { success: false, message: `${patient.firstName} ${patient.lastName} is already admitted in bed ${current.bed.bedNumber} (${current.admissionNumber})` };
    }

    const year = new Date().getFullYear();
    const admissionNumber = formatAdmissionNumber(year, await nextSequence(prisma, `admission-${year}`));

    const admission = await prisma.$transaction(async (tx) => {
      // Re-check the bed inside the transaction so two desks cannot fill the same bed.
      await tx.bed.update({
        where: { id: bed.id, status: { in: ADMITTABLE_BED } },
        data: {
          status: "OCCUPIED",
          patientId: patient.id,
          departmentId: data.departmentId,
          doctorId: data.doctorId,
          notes: null,
          statusUpdatedAt: new Date(),
          updatedById: user.id,
        },
      });
      await tx.bedStatusLog.create({
        data: { bedId: bed.id, previousStatus: bed.status, newStatus: "OCCUPIED", changedById: user.id, notes: `Admitted ${admissionNumber}` },
      });
      return tx.admission.create({
        data: {
          admissionNumber,
          patientId: patient.id,
          bedId: bed.id,
          departmentId: data.departmentId,
          doctorId: data.doctorId,
          admittedById: user.id,
          reason,
          provisionalDiagnosis: data.provisionalDiagnosis?.trim() || null,
        },
        select: { id: true, admissionNumber: true },
      });
    });

    refresh();
    return { success: true, message: `${patient.firstName} ${patient.lastName} admitted to bed ${bed.bedNumber} (${admissionNumber})`, data: admission };
  } catch (error) {
    if (error.code === "P2025") return { success: false, message: "That bed was just taken. Please choose another bed." };
    return failed(error, "Failed to admit patient");
  }
}

function cleanMedications(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => ({ name: m?.name?.trim() || "", dose: m?.dose?.trim() || "", frequency: m?.frequency?.trim() || "", duration: m?.duration?.trim() || "" }))
    .filter((m) => m.name);
}

export async function dischargePatient(admissionId, data = {}) {
  try {
    const { user } = await guardAction("admissions", "update");

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: {
        id: true, status: true, admissionNumber: true, patientId: true, doctorId: true, payerType: true,
        bed: { select: { id: true, status: true } }, doctor: DOCTOR_NAME,
        preAuths: { where: { kind: "FINAL", status: "APPROVED" }, select: { id: true } },
      },
    });
    if (!admission) return { success: false, message: "Admission not found" };
    if (admission.status === "DISCHARGED") return { success: false, message: "This patient has already been discharged" };
    // Insured stays leave only after the insurer's final approval (cashless discharge).
    if (admission.payerType !== "SELF" && admission.preAuths.length === 0) {
      return { success: false, message: "Waiting for final approval from the insurer" };
    }

    const finalDiagnosis = data.finalDiagnosis?.trim();
    if (!finalDiagnosis) return { success: false, message: "Enter the final diagnosis" };
    if (!DISCHARGE_CONDITIONS.includes(data.conditionAtDischarge)) return { success: false, message: "Select the condition at discharge" };

    let followUp = null;
    if (data.followUpDate) {
      const time = data.followUpTime || "10:00";
      const [h, m] = time.split(":").map(Number);
      const when = new Date(data.followUpDate);
      when.setHours(h, m, 0, 0);
      if (Number.isNaN(when.getTime()) || when < new Date()) return { success: false, message: "Choose a follow-up date and time in the future" };
      const clash = await prisma.appointment.findFirst({
        where: { doctorId: admission.doctorId, appointmentDate: new Date(data.followUpDate), appointmentTime: time, status: "SCHEDULED" },
      });
      if (clash) {
        const name = admission.doctor.user;
        return { success: false, message: `Dr. ${name.firstName} ${name.lastName} already has an appointment at ${time} on that date` };
      }
      followUp = { date: new Date(data.followUpDate), time };
    }

    await prisma.$transaction(async (tx) => {
      await tx.admission.update({
        where: { id: admission.id },
        data: {
          status: "DISCHARGED",
          dischargedAt: new Date(),
          dischargedById: user.id,
          finalDiagnosis,
          treatmentGiven: data.treatmentGiven?.trim() || null,
          conditionAtDischarge: data.conditionAtDischarge,
          dischargeMedications: cleanMedications(data.dischargeMedications),
          dischargeAdvice: data.dischargeAdvice?.trim() || null,
          warningSigns: data.warningSigns?.trim() || null,
          followUpDate: followUp?.date ?? null,
        },
      });
      await tx.bed.update({
        where: { id: admission.bed.id },
        data: {
          status: "NEEDS_CLEANING",
          patientId: null,
          departmentId: null,
          doctorId: null,
          notes: "Patient discharged, awaiting housekeeping",
          statusUpdatedAt: new Date(),
          updatedById: user.id,
        },
      });
      await tx.bedStatusLog.create({
        data: { bedId: admission.bed.id, previousStatus: admission.bed.status, newStatus: "NEEDS_CLEANING", changedById: user.id, notes: `Discharged ${admission.admissionNumber}` },
      });
      if (followUp) {
        await tx.appointment.create({
          data: {
            patientId: admission.patientId,
            doctorId: admission.doctorId,
            appointmentDate: followUp.date,
            appointmentTime: followUp.time,
            reason: `Follow-up after discharge (${admission.admissionNumber})`,
          },
        });
      }
    });

    refresh();
    revalidatePath("/appointments");
    return { success: true, message: followUp ? "Patient discharged and follow-up visit booked" : "Patient discharged", data: { id: admission.id } };
  } catch (error) {
    return failed(error, "Failed to discharge patient");
  }
}

function withLatestVitals(admission) {
  const latest = admission.vitals?.[0];
  return { ...admission, latestVitals: latest ? { ...latest, flags: vitalFlags(latest) } : null };
}

export async function getAdmissions({ status, search, wardId } = {}) {
  try {
    const { user, role } = await guardAction("admissions", "read");
    const where = {};
    if (role === "PATIENT") where.patient = { userId: user.id };
    if (status && status !== "all") where.status = status;
    if (wardId && wardId !== "all") where.bed = { wardId };
    const q = search?.trim();
    if (q) {
      where.OR = [
        { admissionNumber: { contains: q, mode: "insensitive" } },
        { patient: { firstName: { contains: q, mode: "insensitive" } } },
        { patient: { lastName: { contains: q, mode: "insensitive" } } },
        { patient: { uhid: { contains: q, mode: "insensitive" } } },
        { patient: { phone: { contains: q } } },
      ];
    }
    const admissions = await prisma.admission.findMany({
      where,
      include: {
        patient: { select: PATIENT_SUMMARY },
        bed: { select: { id: true, bedNumber: true, ward: { select: { id: true, name: true, floor: true } } } },
        department: { select: { id: true, name: true } },
        doctor: DOCTOR_NAME,
        vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      orderBy: [{ status: "asc" }, { admittedAt: "desc" }],
      take: 200,
    });
    return { success: true, data: admissions.map(withLatestVitals) };
  } catch (error) {
    return failed(error, "Failed to load admissions");
  }
}

export async function getAdmission(id) {
  try {
    const { user, role } = await guardAction("admissions", "read");
    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        patient: { select: { ...PATIENT_SUMMARY, userId: true, address: true, emergencyContact: true, user: { select: { email: true } } } },
        bed: { select: { id: true, bedNumber: true, bedType: true, ward: { select: { id: true, name: true, floor: true } } } },
        department: { select: { id: true, name: true } },
        doctor: DOCTOR_NAME,
        admittedBy: STAFF_NAME,
        dischargedBy: STAFF_NAME,
        vitals: { orderBy: { recordedAt: "desc" }, include: { recordedBy: STAFF_NAME } },
        notes: { orderBy: { createdAt: "desc" }, include: { author: STAFF_NAME } },
        handovers: { orderBy: { createdAt: "desc" }, include: { fromUser: STAFF_NAME, acknowledgedBy: STAFF_NAME } },
        preAuths: { where: { kind: "FINAL", status: "APPROVED" }, select: { id: true } },
      },
    });
    if (!admission || (role === "PATIENT" && admission.patient.userId !== user.id)) {
      return { success: false, message: "Admission not found" };
    }
    const patient = { ...admission.patient };
    delete patient.userId;
    // Shift handovers and staff notes are internal working records; patients get vitals and the discharge summary.
    const internal = role === "PATIENT" ? { notes: [], handovers: [] } : {};
    const { preAuths, ...rest } = admission;
    // Cashless stays wait for the insurer's final approval before discharge.
    const awaitingInsurer = admission.payerType !== "SELF" && preAuths.length === 0;
    return {
      success: true,
      data: {
        ...rest,
        awaitingInsurer,
        patient,
        vitals: admission.vitals.map((v) => ({ ...v, flags: vitalFlags(v) })),
        ...internal,
      },
    };
  } catch (error) {
    return failed(error, "Failed to load admission");
  }
}
