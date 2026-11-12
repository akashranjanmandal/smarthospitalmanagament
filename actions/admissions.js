"use server";

import { prisma, withTransaction } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { nextSequence, logView } from "@/lib/audit/extension";
import { formatAdmissionNumber } from "@/lib/identifiers";
import { vitalFlags } from "@/lib/clinical/vitals";
import { BED_STATUS_LABELS } from "@/lib/constants";
import { branchScope, resolveBranchId, isChainWide } from "@/lib/branch-scope";
import { assignedWardIds, ROSTERABLE_ROLES } from "@/lib/roster";

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

const ADMITTABLE_PATIENT_SELECT = { id: true, uhid: true, firstName: true, lastName: true, phone: true, gender: true };
const NOT_ALREADY_ADMITTED = { admissions: { none: { status: "ADMITTED" } } };

export async function getAdmitFormOptions({ patientId } = {}) {
  try {
    const { user } = await guardAction("admissions", "create");
    const branch = branchScope(user);
    const [beds, patients, departments, doctors] = await Promise.all([
      prisma.bed.findMany({
        where: { status: { in: ADMITTABLE_BED }, ward: branch },
        select: { id: true, bedNumber: true, bedType: true, status: true, ward: { select: { id: true, name: true, floor: true, departmentId: true, genderWard: true } } },
        orderBy: [{ ward: { floor: "asc" } }, { ward: { name: "asc" } }, { bedNumber: "asc" }],
      }),
      // The picker is filled by live search (searchAdmittablePatients) instead of loading every
      // patient; the one exception is a patient already chosen via a deep link (?patientId=...).
      // Patients are chain-wide, never branch-scoped: any patient can be admitted at any branch.
      patientId
        ? prisma.patient.findMany({ where: { id: patientId, ...NOT_ALREADY_ADMITTED }, select: ADMITTABLE_PATIENT_SELECT })
        : [],
      prisma.department.findMany({ where: { status: "ACTIVE", ...branch }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.doctor.findMany({
        where: { available: true, department: branch },
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

/** Live search for the admit form's patient picker: name, UHID or phone, never a patient already admitted. */
export async function searchAdmittablePatients(query) {
  try {
    await guardAction("admissions", "create");
    const q = String(query ?? "").trim();
    if (q.length < 2) return { success: true, data: [] };

    const patients = await prisma.patient.findMany({
      where: {
        ...NOT_ALREADY_ADMITTED,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { uhid: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: ADMITTABLE_PATIENT_SELECT,
      orderBy: { firstName: "asc" },
      take: 20,
    });
    return { success: true, data: patients };
  } catch (error) {
    return failed(error, "Search failed");
  }
}

export async function admitPatient(data = {}) {
  try {
    const { user, role } = await guardAction("admissions", "create");

    if (!data.patientId) return { success: false, message: "Select the patient" };
    if (!data.bedId) return { success: false, message: "Select a bed" };
    const reason = data.reason?.trim();
    if (!reason) return { success: false, message: "Enter the reason for admission" };
    if (!data.departmentId) return { success: false, message: "Select the admitting department" };
    if (!data.doctorId) return { success: false, message: "Select the attending doctor" };

    const [patient, bed, doctor, department] = await Promise.all([
      prisma.patient.findUnique({ where: { id: data.patientId }, select: { id: true, firstName: true, lastName: true } }),
      prisma.bed.findUnique({ where: { id: data.bedId }, select: { id: true, bedNumber: true, status: true } }),
      prisma.doctor.findUnique({ where: { id: data.doctorId }, select: { departmentId: true } }),
      prisma.department.findUnique({ where: { id: data.departmentId }, select: { branchId: true } }),
    ]);
    if (!patient) return { success: false, message: "Patient not found" };
    if (!bed) return { success: false, message: "Bed not found" };
    if (!doctor || doctor.departmentId !== data.departmentId) {
      return { success: false, message: "The selected doctor is not in the selected department" };
    }
    if (!department) return { success: false, message: "Department not found" };
    if (!isChainWide(role) && department.branchId !== user.branchId) {
      return { success: false, message: "That department is not in your branch" };
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

    const admission = await withTransaction(async (tx) => {
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
          branchId: department.branchId,
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

/** Vacant/reserved beds in the admission's own branch, for the transfer dialog. */
export async function getTransferableBeds(admissionId) {
  try {
    await guardAction("beds", "read");
    const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { branchId: true, bedId: true } });
    if (!admission) return { success: false, data: [] };
    const beds = await prisma.bed.findMany({
      where: { status: { in: ADMITTABLE_BED }, ward: { branchId: admission.branchId }, NOT: { id: admission.bedId } },
      select: { id: true, bedNumber: true, bedType: true, ward: { select: { name: true, floor: true } } },
      orderBy: [{ ward: { floor: "asc" } }, { bedNumber: "asc" }],
    });
    return { success: true, data: beds };
  } catch {
    return { success: false, data: [] };
  }
}

/**
 * Move a patient who stays admitted to a different bed (ward transfer, e.g. general ward to
 * ICU): the stay, its bill and its clinical record stay on the same admission instead of being
 * broken by a discharge-and-readmit. Guarded on "beds" (ward staff do this), not "admissions".
 */
export async function transferAdmission(admissionId, data = {}) {
  try {
    const { user, role } = await guardAction("beds", "update");

    const reason = data.reason?.trim();
    if (!reason) return { success: false, message: "Enter a reason for the transfer" };
    if (!data.toBedId) return { success: false, message: "Select the bed to transfer to" };

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, admissionNumber: true, status: true, bedId: true, patientId: true, departmentId: true, doctorId: true, branchId: true },
    });
    if (!admission) return { success: false, message: "Admission not found" };
    if (!isChainWide(role) && admission.branchId !== user.branchId) return { success: false, message: "Admission not found" };
    if (admission.status !== "ADMITTED") return { success: false, message: "This patient is not currently admitted" };
    if (data.toBedId === admission.bedId) return { success: false, message: "Already in that bed" };

    const [fromBed, toBed] = await Promise.all([
      prisma.bed.findUnique({ where: { id: admission.bedId }, select: { id: true, status: true } }),
      prisma.bed.findUnique({ where: { id: data.toBedId }, select: { id: true, bedNumber: true, status: true, ward: { select: { branchId: true } } } }),
    ]);
    if (!toBed) return { success: false, message: "Bed not found" };
    if (toBed.ward.branchId !== admission.branchId) return { success: false, message: "That bed is in a different branch" };
    if (!ADMITTABLE_BED.includes(toBed.status)) {
      return { success: false, message: `Bed ${toBed.bedNumber} is not available (${BED_STATUS_LABELS[toBed.status]})` };
    }

    await withTransaction(async (tx) => {
      await tx.bed.update({
        where: { id: fromBed.id, status: "OCCUPIED" },
        data: { status: "NEEDS_CLEANING", patientId: null, departmentId: null, doctorId: null, notes: `Transferred out, ${admission.admissionNumber}`, statusUpdatedAt: new Date(), updatedById: user.id },
      });
      await tx.bedStatusLog.create({
        data: { bedId: fromBed.id, previousStatus: "OCCUPIED", newStatus: "NEEDS_CLEANING", changedById: user.id, notes: `Transferred to ${toBed.bedNumber} (${admission.admissionNumber})` },
      });
      await tx.bed.update({
        where: { id: toBed.id, status: { in: ADMITTABLE_BED } },
        data: { status: "OCCUPIED", patientId: admission.patientId, departmentId: admission.departmentId, doctorId: admission.doctorId, notes: null, statusUpdatedAt: new Date(), updatedById: user.id },
      });
      await tx.bedStatusLog.create({
        data: { bedId: toBed.id, previousStatus: toBed.status, newStatus: "OCCUPIED", changedById: user.id, notes: `Transfer in (${admission.admissionNumber}): ${reason}` },
      });
      await tx.admission.update({ where: { id: admission.id }, data: { bedId: toBed.id } });
      await tx.bedTransfer.create({
        data: { admissionId: admission.id, fromBedId: fromBed.id, toBedId: toBed.id, reason, transferredById: user.id },
      });
    });

    refresh();
    return { success: true, message: `Transferred to bed ${toBed.bedNumber}` };
  } catch (error) {
    if (error.code === "P2025") return { success: false, message: "That bed was just taken. Please choose another bed." };
    return failed(error, "Failed to transfer patient");
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

    await withTransaction(async (tx) => {
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
    let rosteredWardIds = null;
    if (role === "PATIENT") where.patient = { userId: user.id };
    else {
      Object.assign(where, branchScope(user));
      // Same roster scoping as the bed board: rostered today, see only those wards; not
      // rostered yet, see the whole branch.
      if (ROSTERABLE_ROLES.includes(role)) {
        const wardIds = await assignedWardIds(user.id);
        if (wardIds.length > 0) rosteredWardIds = wardIds;
      }
    }
    if (status && status !== "all") where.status = status;
    if (wardId && wardId !== "all") {
      // An explicit ward filter can only narrow within what the roster already allows, never escape it.
      if (rosteredWardIds && !rosteredWardIds.includes(wardId)) where.bed = { wardId: "__not_rostered__" };
      else where.bed = { wardId };
    } else if (rosteredWardIds) {
      where.bed = { wardId: { in: rosteredWardIds } };
    }
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
    const outsideOwnBranch = role !== "PATIENT" && !isChainWide(role) && admission?.branchId !== user.branchId;
    if (!admission || (role === "PATIENT" && admission.patient.userId !== user.id) || outsideOwnBranch) {
      return { success: false, message: "Admission not found" };
    }
    const patient = { ...admission.patient };
    delete patient.userId;
    // Shift handovers and staff notes are internal working records; patients get vitals and the discharge summary.
    const internal = role === "PATIENT" ? { notes: [], handovers: [] } : {};
    const { preAuths, ...rest } = admission;
    // Cashless stays wait for the insurer's final approval before discharge.
    const awaitingInsurer = admission.payerType !== "SELF" && preAuths.length === 0;
    await logView(prisma, "Admission", admission.id);
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
