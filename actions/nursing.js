"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { validateVitals, vitalFlags } from "@/lib/clinical/vitals";
import { lengthOfStayDays } from "@/lib/identifiers";

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

async function activeAdmission(admissionId) {
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, status: true } });
  if (!admission) return { error: "Admission not found" };
  if (admission.status !== "ADMITTED") return { error: "This patient has been discharged" };
  return { admission };
}

function refresh(admissionId) {
  revalidatePath(`/admissions/${admissionId}`);
  revalidatePath("/handover");
}

export async function recordVitals(admissionId, data = {}) {
  try {
    const { user } = await guardAction("nursing", "create");
    const { error } = await activeAdmission(admissionId);
    if (error) return { success: false, message: error };
    const check = validateVitals(data);
    if (!check.ok) return { success: false, message: check.message };

    const vitals = await prisma.vitalSign.create({
      data: { admissionId, recordedById: user.id, ...check.values, notes: data.notes?.trim() || null },
    });
    refresh(admissionId);
    const flags = vitalFlags(vitals);
    return {
      success: true,
      message: flags.length ? `Vitals saved — attention: ${flags.map((f) => f.label).join(", ")}` : "Vitals saved",
      data: { id: vitals.id, flags },
    };
  } catch (error) {
    return failed(error, "Failed to save vitals");
  }
}

export async function addClinicalNote(admissionId, data = {}) {
  try {
    const { user, role } = await guardAction("nursing", "create");
    const { error } = await activeAdmission(admissionId);
    if (error) return { success: false, message: error };
    const content = data.content?.trim();
    if (!content) return { success: false, message: "Write the note before saving" };

    const note = await prisma.clinicalNote.create({
      data: { admissionId, authorId: user.id, type: role === "DOCTOR" ? "DOCTOR_ROUND" : "NURSING", content },
      select: { id: true, type: true },
    });
    refresh(admissionId);
    return { success: true, message: "Note saved", data: note };
  } catch (error) {
    return failed(error, "Failed to save note");
  }
}

export async function createHandover(admissionId, data = {}) {
  try {
    const { user } = await guardAction("nursing", "create");
    const { error } = await activeAdmission(admissionId);
    if (error) return { success: false, message: error };
    const [situation, background, assessment, recommendation, pendingTasks] =
      ["situation", "background", "assessment", "recommendation", "pendingTasks"].map((k) => data[k]?.trim() || "");
    if (!situation || !assessment || !recommendation) {
      return { success: false, message: "Situation, assessment and recommendation are required" };
    }
    const handover = await prisma.handover.create({
      data: { admissionId, fromUserId: user.id, situation, background: background || null, assessment, recommendation, pendingTasks: pendingTasks || null },
      select: { id: true },
    });
    refresh(admissionId);
    return { success: true, message: "Handover recorded", data: handover };
  } catch (error) {
    return failed(error, "Failed to record handover");
  }
}

export async function acknowledgeHandover(handoverId) {
  try {
    const { user } = await guardAction("nursing", "update");
    const handover = await prisma.handover.findUnique({ where: { id: handoverId }, select: { id: true, admissionId: true, fromUserId: true, acknowledgedById: true } });
    if (!handover) return { success: false, message: "Handover not found" };
    if (handover.acknowledgedById) return { success: false, message: "This handover was already acknowledged" };
    if (handover.fromUserId === user.id) return { success: false, message: "The incoming staff member must acknowledge this handover" };

    await prisma.handover.update({ where: { id: handover.id }, data: { acknowledgedById: user.id, acknowledgedAt: new Date() } });
    refresh(handover.admissionId);
    return { success: true, message: "Handover acknowledged" };
  } catch (error) {
    return failed(error, "Failed to acknowledge handover");
  }
}

const fullName = (u) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : null);

/** Everything the incoming shift needs for every in-patient, in bed order. */
export async function getWardHandoverSheet({ wardId } = {}) {
  try {
    await guardAction("nursing", "read");
    const where = { status: "ADMITTED" };
    if (wardId && wardId !== "all") where.bed = { wardId };
    const [admissions, wards] = await Promise.all([
      prisma.admission.findMany({
        where,
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
          bed: { select: { bedNumber: true, ward: { select: { id: true, name: true, floor: true } } } },
          department: { select: { name: true } },
          doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
          vitals: { orderBy: { recordedAt: "desc" }, take: 1, include: { recordedBy: { select: { firstName: true, lastName: true } } } },
          notes: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { firstName: true, lastName: true, role: true } } } },
          handovers: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { fromUser: { select: { firstName: true, lastName: true } }, acknowledgedBy: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: [{ bed: { ward: { floor: "asc" } } }, { bed: { ward: { name: "asc" } } }, { bed: { bedNumber: "asc" } }],
      }),
      prisma.ward.findMany({ select: { id: true, name: true, floor: true }, orderBy: [{ floor: "asc" }, { name: "asc" }] }),
    ]);

    const patients = admissions.map((a) => {
      const v = a.vitals[0];
      const n = a.notes[0];
      const h = a.handovers[0];
      return {
        admissionId: a.id,
        admissionNumber: a.admissionNumber,
        bedNumber: a.bed.bedNumber,
        ward: a.bed.ward,
        dayOfStay: lengthOfStayDays(a.admittedAt),
        admittedAt: a.admittedAt,
        patient: a.patient,
        doctor: `Dr. ${fullName(a.doctor.user)}`,
        department: a.department.name,
        reason: a.reason,
        provisionalDiagnosis: a.provisionalDiagnosis,
        latestVitals: v ? { ...v, recordedBy: fullName(v.recordedBy), flags: vitalFlags(v) } : null,
        latestNote: n ? { content: n.content, type: n.type, createdAt: n.createdAt, author: fullName(n.author) } : null,
        latestHandover: h
          ? {
              id: h.id,
              situation: h.situation,
              background: h.background,
              assessment: h.assessment,
              recommendation: h.recommendation,
              pendingTasks: h.pendingTasks,
              createdAt: h.createdAt,
              from: fullName(h.fromUser),
              acknowledged: Boolean(h.acknowledgedById),
              acknowledgedBy: fullName(h.acknowledgedBy),
              acknowledgedAt: h.acknowledgedAt,
            }
          : null,
      };
    });
    return { success: true, data: { patients, wards, generatedAt: new Date() } };
  } catch (error) {
    return failed(error, "Failed to load handover sheet");
  }
}
