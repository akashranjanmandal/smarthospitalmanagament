"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";

export async function createAppointment(data) {
  try {
    const { user, role } = await guardAction("appointments", "create");

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient) return { success: false, message: "Patient profile not found. Please register as a patient first." };
      data.patientId = patient.id;
    }

    // Validate that appointmentDate + appointmentTime is not in the past
    const [hours, minutes] = data.appointmentTime.split(":").map(Number);
    const appointmentDateTime = new Date(data.appointmentDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    if (appointmentDateTime < new Date()) {
      return { success: false, message: "Cannot book appointments for past dates or times" };
    }

    const existing = await prisma.appointment.findFirst({
      where: { doctorId: data.doctorId, appointmentDate: new Date(data.appointmentDate), appointmentTime: data.appointmentTime, status: "SCHEDULED" },
    });

    if (existing) return { success: false, message: "This time slot is already booked for the selected doctor" };

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        appointmentDate: new Date(data.appointmentDate),
        appointmentTime: data.appointmentTime,
        reason: data.reason || null,
        notes: data.notes || null,
        status: "SCHEDULED",
      },
      include: { doctor: { include: { user: true, department: true } }, patient: true },
    });

    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { success: true, message: "Appointment booked successfully", data: appointment };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create appointments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create appointment error:", error);
    return { success: false, message: "Failed to book appointment" };
  }
}

export async function updateAppointment(id, data) {
  try {
    const { user, role } = await guardAction("appointments", "update");

    if (role === "PATIENT") {
      const apt = await prisma.appointment.findUnique({ where: { id }, include: { patient: true } });
      if (!apt || apt.patient.userId !== user.id) return { success: false, message: "You can only modify your own appointments" };
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined, appointmentTime: data.appointmentTime, status: data.status, reason: data.reason, notes: data.notes },
      include: { doctor: { include: { user: true, department: true } }, patient: true },
    });

    revalidatePath("/appointments");
    revalidatePath(`/appointments/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Appointment updated successfully", data: appointment };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update appointments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update appointment error:", error);
    return { success: false, message: "Failed to update appointment" };
  }
}

export async function cancelAppointment(id) {
  try {
    const { user, role } = await guardAction("appointments", "update");

    if (role === "PATIENT") {
      const apt = await prisma.appointment.findUnique({ where: { id }, include: { patient: true } });
      if (!apt || apt.patient.userId !== user.id) return { success: false, message: "You can only cancel your own appointments" };
    }

    const appointment = await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Appointment cancelled successfully", data: appointment };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to cancel appointments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Cancel appointment error:", error);
    return { success: false, message: "Failed to cancel appointment" };
  }
}

export async function completeAppointment(id) {
  try {
    const { user, role } = await guardAction("appointments", "update");

    if (role === "PATIENT") return { success: false, message: "Patients cannot complete appointments" };

    const appointment = await prisma.appointment.update({ where: { id }, data: { status: "COMPLETED" } });
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { success: true, message: "Appointment marked as completed", data: appointment };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to complete appointments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Complete appointment error:", error);
    return { success: false, message: "Failed to complete appointment" };
  }
}

export async function getAppointments({ search, status, doctorId, patientId, date, page = 1, limit = 10 } = {}) {
  try {
    const { user, role } = await guardAction("appointments", "read");

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
          { doctor: { user: { firstName: { contains: search, mode: "insensitive" } } } },
          { doctor: { user: { lastName: { contains: search, mode: "insensitive" } } } },
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
        ];
      }
      if (doctorId) where.doctorId = doctorId;
      if (patientId) where.patientId = patientId;
    }

    if (status && status !== "all") where.status = status;

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.appointmentDate = { gte: start, lt: end };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { doctor: { include: { user: true, department: true } }, patient: true },
        orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { success: true, data: appointments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get appointments error:", error);
    return { success: false, message: "Failed to fetch appointments" };
  }
}

export async function getAppointmentById(id) {
  try {
    const { user, role } = await guardAction("appointments", "read");

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: { include: { user: true, department: true } }, patient: true, medicalRecord: true, bill: true },
    });

    if (!appointment) return { success: false, message: "Appointment not found" };

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || appointment.patientId !== patient.id) return { success: false, message: "Access denied" };
    }
    if (role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor || appointment.doctorId !== doctor.id) return { success: false, message: "Access denied" };
    }

    return { success: true, data: appointment };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get appointment error:", error);
    return { success: false, message: "Failed to fetch appointment" };
  }
}

export async function getTodayAppointments() {
  try {
    const { user } = await guardAction("appointments", "read");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await prisma.appointment.findMany({
      where: { appointmentDate: { gte: today, lt: tomorrow }, status: "SCHEDULED" },
      include: { doctor: { include: { user: true, department: true } }, patient: true },
      orderBy: { appointmentTime: "asc" },
    });

    return { success: true, data: appointments };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get today appointments error:", error);
    return { success: false, message: "Failed to fetch today's appointments" };
  }
}
