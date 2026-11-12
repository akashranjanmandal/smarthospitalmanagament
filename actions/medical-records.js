"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";

export async function createMedicalRecord(data) {
  try {
    const { user } = await guardAction("medicalRecords", "create");

    const existing = await prisma.medicalRecord.findUnique({ where: { appointmentId: data.appointmentId } });
    if (existing) return { success: false, message: "Medical record already exists for this appointment" };

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentId: data.appointmentId,
        diagnosis: data.diagnosis,
        symptoms: data.symptoms,
        treatment: data.treatment,
        allergies: data.allergies || null,
        doctorNotes: data.doctorNotes || null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      },
      include: { patient: true, doctor: { include: { user: true, department: true } }, appointment: true },
    });

    revalidatePath("/medical-records");
    revalidatePath("/dashboard");
    return { success: true, message: "Medical record created successfully", data: record };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create medical records" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create medical record error:", error);
    return { success: false, message: `Failed to create medical record: ${error.message}` };
  }
}

export async function updateMedicalRecord(id, data) {
  try {
    const { user } = await guardAction("medicalRecords", "update");

    const record = await prisma.medicalRecord.update({
      where: { id },
      data: { diagnosis: data.diagnosis, symptoms: data.symptoms, treatment: data.treatment, allergies: data.allergies, doctorNotes: data.doctorNotes, followUpDate: data.followUpDate ? new Date(data.followUpDate) : null },
      include: { patient: true, doctor: { include: { user: true, department: true } }, appointment: true },
    });

    revalidatePath("/medical-records");
    revalidatePath(`/medical-records/${id}`);
    return { success: true, message: "Medical record updated successfully", data: record };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update medical records" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update medical record error:", error);
    return { success: false, message: "Failed to update medical record" };
  }
}

export async function getMedicalRecords({ search, patientId, doctorId, page = 1, limit = 10 } = {}) {
  try {
    const { user, role } = await guardAction("medicalRecords", "read");

    const where = {};

    if (role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) where.doctorId = doctor.id;
    } else if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) where.patientId = patient.id;
    } else {
      if (search) {
        where.OR = [
          { diagnosis: { contains: search, mode: "insensitive" } },
          { symptoms: { contains: search, mode: "insensitive" } },
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
        ];
      }
      if (patientId) where.patientId = patientId;
      if (doctorId) where.doctorId = doctorId;
    }

    const [records, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        include: { patient: true, doctor: { include: { user: true, department: true } }, appointment: true, prescriptions: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    return { success: true, data: records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get medical records error:", error);
    return { success: false, message: "Failed to fetch medical records" };
  }
}

export async function getMedicalRecordById(id) {
  try {
    const { user, role } = await guardAction("medicalRecords", "read");

    const record = await prisma.medicalRecord.findUnique({
      where: { id },
      include: { patient: true, doctor: { include: { user: true, department: true } }, appointment: true, prescriptions: { include: { items: true }, orderBy: { createdAt: "desc" } } },
    });

    if (!record) return { success: false, message: "Medical record not found" };

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || record.patientId !== patient.id) return { success: false, message: "Access denied" };
    }

    return { success: true, data: record };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get medical record error:", error);
    return { success: false, message: "Failed to fetch medical record" };
  }
}

export async function getPatientMedicalHistory(patientId) {
  try {
    const { user } = await guardAction("medicalRecords", "read");

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      include: { doctor: { include: { user: true, department: true } }, appointment: true, prescriptions: { include: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: records };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get patient history error:", error);
    return { success: false, message: "Failed to fetch patient history" };
  }
}
