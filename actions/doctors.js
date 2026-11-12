"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";

export async function createDoctor(data) {
  try {
    const { user } = await guardAction("doctors", "create");

    let doctorUser;

    if (data.userId) {
      doctorUser = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!doctorUser) return { success: false, message: "User not found" };
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

      if (existingUser) {
        const existingDoctor = await prisma.doctor.findUnique({ where: { userId: existingUser.id } });
        if (existingDoctor) return { success: false, message: "This email is already registered as a doctor" };
        doctorUser = existingUser;
      } else {
        doctorUser = await prisma.user.create({
          data: {
            clerkId: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: "DOCTOR",
          },
        });
      }
    }

    const existingDoctor = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } });
    if (existingDoctor) return { success: false, message: "This user is already registered as a doctor" };

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        departmentId: data.departmentId,
        specialization: data.specialization,
        qualification: data.qualification,
        experience: data.experience || 0,
        phone: data.phone,
        available: data.available ?? true,
      },
      include: { user: true, department: true },
    });

    revalidatePath("/doctors");
    revalidatePath("/dashboard");
    return { success: true, message: "Doctor registered successfully", data: doctor };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create doctors" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create doctor error:", error);
    return { success: false, message: "Failed to register doctor" };
  }
}

export async function updateDoctor(id, data) {
  try {
    const { user } = await guardAction("doctors", "update");

    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        departmentId: data.departmentId,
        specialization: data.specialization,
        qualification: data.qualification,
        experience: data.experience,
        phone: data.phone,
        available: data.available,
      },
      include: { user: true, department: true },
    });

    revalidatePath("/doctors");
    revalidatePath(`/doctors/${id}`);
    return { success: true, message: "Doctor updated successfully", data: doctor };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update doctors" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update doctor error:", error);
    return { success: false, message: "Failed to update doctor" };
  }
}

export async function deleteDoctor(id) {
  try {
    const { user } = await guardAction("doctors", "delete");

    const appointmentCount = await prisma.appointment.count({ where: { doctorId: id, status: "SCHEDULED" } });
    if (appointmentCount > 0) return { success: false, message: `Cannot remove doctor with ${appointmentCount} scheduled appointment(s).` };

    await prisma.doctor.delete({ where: { id } });
    revalidatePath("/doctors");
    revalidatePath("/dashboard");
    return { success: true, message: "Doctor removed successfully" };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to delete doctors" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Delete doctor error:", error);
    return { success: false, message: "Failed to remove doctor" };
  }
}

export async function getDoctors({ search, departmentId, available, page = 1, limit = 10 } = {}) {
  try {
    const { user, role } = await guardAction("doctors", "read");

    const where = {};

    if (role === "DOCTOR") {
      where.userId = user.id;
    } else {
      if (search) {
        where.OR = [
          { user: { firstName: { contains: search, mode: "insensitive" } } },
          { user: { lastName: { contains: search, mode: "insensitive" } } },
          { specialization: { contains: search, mode: "insensitive" } },
        ];
      }
      if (departmentId) where.departmentId = departmentId;
      if (available !== undefined && available !== "all") where.available = available === "true";
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: { user: true, department: true, _count: { select: { appointments: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doctor.count({ where }),
    ]);

    return { success: true, data: doctors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get doctors error:", error);
    return { success: false, message: "Failed to fetch doctors" };
  }
}

export async function getDoctorById(id) {
  try {
    const { user } = await guardAction("doctors", "read");

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: true, department: true,
        appointments: { orderBy: { appointmentDate: "desc" }, take: 10, include: { patient: true } },
        _count: { select: { appointments: true, medicalRecords: true, prescriptions: true } },
      },
    });

    if (!doctor) return { success: false, message: "Doctor not found" };
    return { success: true, data: doctor };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get doctor error:", error);
    return { success: false, message: "Failed to fetch doctor" };
  }
}

export async function getAllDoctors() {
  try {
    const { user } = await guardAction("doctors", "read");

    const doctors = await prisma.doctor.findMany({
      where: { available: true },
      include: { user: true, department: true },
      orderBy: { user: { firstName: "asc" } },
    });
    return { success: true, data: doctors };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get all doctors error:", error);
    return { success: false, message: "Failed to fetch doctors" };
  }
}
