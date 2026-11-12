"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { ensureUser } from "@/lib/auth";

export async function createPatient(data) {
  try {
    const user = await ensureUser();
    if (!user) return { success: false, message: "Unauthorized" };

    const { role } = await guardAction("patients", "create");
    const patientData = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      gender: data.gender,
      dateOfBirth: new Date(data.dateOfBirth),
      bloodGroup: data.bloodGroup || null,
      phone: data.phone.trim(),
      emergencyContact: data.emergencyContact || null,
      address: data.address || null,
    };

    // Patients complete their own profile. Staff members create a provisional
    // account that is linked automatically if the patient later signs in with
    // the same email address.
    let patient;

    if (role === "PATIENT") {
      const existing = await prisma.patient.findUnique({ where: { userId: user.id } });
      patient = existing
        ? await prisma.patient.update({
            where: { userId: user.id },
            data: patientData,
            include: { user: true },
          })
        : await prisma.patient.create({
            data: { userId: user.id, ...patientData },
            include: { user: true },
          });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          phone: patientData.phone,
          profileComplete: true,
        },
      });
    } else {
      patient = await prisma.$transaction(async (tx) => {
        const email = data.email?.trim()?.toLowerCase() || null;
        const phone = patientData.phone;

        if (email) {
          const existingUser = await tx.user.findUnique({ where: { email } });
          if (existingUser) {
            throw new Error("A patient or user with this email address already exists");
          }
        }

        if (phone) {
          const existingPhone = await tx.user.findFirst({ where: { phone } });
          if (existingPhone) {
            throw new Error("A patient with this phone number already exists");
          }
        }

        const provisionalUser = await tx.user.create({
          data: {
            email: email || `${phone}@phone.local`,
            phone,
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            role: "PATIENT",
            profileComplete: true,
          },
        });

        return tx.patient.create({
          data: { userId: provisionalUser.id, ...patientData },
          include: { user: true },
        });
      });
    }

    revalidatePath("/patients");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: role === "PATIENT" ? "Profile completed successfully" : "Patient registered successfully",
      data: patient,
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to register patients" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create patient error:", error);
    return { success: false, message: `Failed to register patient: ${error.message}` };
  }
}

export async function updatePatient(id, data) {
  try {
    const { user, role } = await guardAction("patients", "update");

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient || patient.userId !== user.id) {
        return { success: false, message: "You can only update your own profile" };
      }
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: new Date(data.dateOfBirth),
        bloodGroup: data.bloodGroup || null,
        phone: data.phone,
        emergencyContact: data.emergencyContact || null,
        address: data.address || null,
      },
      include: { user: true },
    });

    revalidatePath("/patients");
    revalidatePath(`/patients/${id}`);
    return { success: true, message: "Patient updated successfully", data: patient };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update patients" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update patient error:", error);
    return { success: false, message: "Failed to update patient" };
  }
}

export async function deletePatient(id) {
  try {
    const { user } = await guardAction("patients", "update");

    const appointmentCount = await prisma.appointment.count({ where: { patientId: id, status: "SCHEDULED" } });
    if (appointmentCount > 0) return { success: false, message: `Cannot archive patient with ${appointmentCount} scheduled appointment(s).` };

    await prisma.patient.delete({ where: { id } });
    revalidatePath("/patients");
    revalidatePath("/dashboard");
    return { success: true, message: "Patient archived successfully" };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to archive patients" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Delete patient error:", error);
    return { success: false, message: "Failed to archive patient" };
  }
}

export async function getPatients({ search, gender, page = 1, limit = 10 } = {}) {
  try {
    const { user, role } = await guardAction("patients", "read");

    const where = {};

    if (role === "PATIENT") {
      where.userId = user.id;
    } else {
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { uhid: { contains: search, mode: "insensitive" } },
        ];
      }
      if (gender && gender !== "all") where.gender = gender;
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: { user: true, _count: { select: { appointments: true, medicalRecords: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    return { success: true, data: patients, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get patients error:", error);
    return { success: false, message: "Failed to fetch patients" };
  }
}

export async function getPatientById(id) {
  try {
    const { user, role } = await guardAction("patients", "read");

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: true,
        appointments: { orderBy: { appointmentDate: "desc" }, take: 10, include: { doctor: { include: { user: true, department: true } } } },
        medicalRecords: { orderBy: { createdAt: "desc" }, take: 5, include: { doctor: { include: { user: true } } } },
        bills: { orderBy: { createdAt: "desc" }, take: 5 },
        _count: { select: { appointments: true, medicalRecords: true, bills: true } },
      },
    });

    if (!patient) return { success: false, message: "Patient not found" };

    if (role === "PATIENT" && patient.userId !== user.id) {
      return { success: false, message: "You can only view your own profile" };
    }

    return { success: true, data: patient };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get patient error:", error);
    return { success: false, message: "Failed to fetch patient" };
  }
}

export async function getAllPatients() {
  try {
    const { user, role } = await guardAction("patients", "read");

    const patients = await prisma.patient.findMany({
      where: role === "PATIENT" ? { userId: user.id } : undefined,
      include: { user: true },
      orderBy: { firstName: "asc" },
    });
    return { success: true, data: patients };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get all patients error:", error);
    return { success: false, message: "Failed to fetch patients" };
  }
}

/** Known allergies, checked whenever medicines are prescribed or ordered. Doctors, nurses and front desk can record them. */
export async function updateAllergies(patientId, allergies) {
  try {
    const user = await ensureUser();
    if (!user) return { success: false, message: "Unauthorized" };
    const { canCreate, canUpdate } = await import("@/lib/permissions");
    if (!canCreate("nursing", user.role) && !canUpdate("patients", user.role)) {
      return { success: false, message: "You do not have permission to change allergies" };
    }
    const text = String(allergies ?? "").split(",").map((a) => a.trim()).filter(Boolean).join(", ");
    await prisma.patient.update({ where: { id: patientId }, data: { allergies: text || null } });
    revalidatePath(`/patients/${patientId}`);
    revalidatePath("/admissions");
    return { success: true, message: text ? `Allergies recorded: ${text}` : "Allergies cleared (none known)" };
  } catch (error) {
    console.error("Update allergies error:", error);
    return { success: false, message: "Failed to save allergies" };
  }
}
