"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { calculateBillTotal } from "@/lib/billing";

export async function createBill(data) {
  try {
    const { user } = await guardAction("billing", "create");

    const existing = await prisma.bill.findUnique({ where: { appointmentId: data.appointmentId } });
    if (existing) return { success: false, message: "Bill already exists for this appointment" };

    const amounts = calculateBillTotal(data);
    if (!amounts.ok) return { success: false, message: amounts.message };
    const { consultationFee, additionalCharges, discount, totalAmount } = amounts;

    const bill = await prisma.bill.create({
      data: {
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        consultationFee,
        additionalCharges,
        discount,
        totalAmount,
        paymentStatus: data.paymentStatus || "PENDING",
        paymentMethod: data.paymentMethod || null,
      },
      include: { patient: true, appointment: { include: { doctor: { include: { user: true } } } } },
    });

    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { success: true, message: "Bill generated successfully", data: bill };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create bills" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create bill error:", error);
    return { success: false, message: `Failed to generate bill: ${error.message}` };
  }
}

export async function updateBill(id, data) {
  try {
    const { user } = await guardAction("billing", "update");

    const amounts = calculateBillTotal(data);
    if (!amounts.ok) return { success: false, message: amounts.message };
    const { consultationFee, additionalCharges, discount, totalAmount } = amounts;

    const bill = await prisma.bill.update({
      where: { id },
      data: { consultationFee, additionalCharges, discount, totalAmount, paymentStatus: data.paymentStatus, paymentMethod: data.paymentMethod },
      include: { patient: true, appointment: { include: { doctor: { include: { user: true } } } } },
    });

    revalidatePath("/billing");
    revalidatePath(`/billing/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Bill updated successfully", data: bill };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update bills" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update bill error:", error);
    return { success: false, message: "Failed to update bill" };
  }
}

export async function getBills({ search, paymentStatus, page = 1, limit = 10 } = {}) {
  try {
    const { user, role } = await guardAction("billing", "read");

    const where = {};

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) where.patientId = patient.id;
    } else {
      if (search) {
        where.OR = [
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
        ];
      }
    }

    if (paymentStatus && paymentStatus !== "all") where.paymentStatus = paymentStatus;

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: { patient: true, appointment: { include: { doctor: { include: { user: true, department: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    return { success: true, data: bills, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get bills error:", error);
    return { success: false, message: "Failed to fetch bills" };
  }
}

export async function getBillById(id) {
  try {
    const { user, role } = await guardAction("billing", "read");

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { patient: true, appointment: { include: { doctor: { include: { user: true, department: true } }, patient: true } } },
    });

    if (!bill) return { success: false, message: "Bill not found" };

    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || bill.patientId !== patient.id) return { success: false, message: "Access denied" };
    }

    return { success: true, data: bill };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get bill error:", error);
    return { success: false, message: "Failed to fetch bill" };
  }
}

export async function markBillPaid(id, paymentMethod) {
  try {
    const { user } = await guardAction("billing", "update");

    const bill = await prisma.bill.update({
      where: { id },
      data: { paymentStatus: "PAID", paymentMethod },
    });

    revalidatePath("/billing");
    revalidatePath(`/billing/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Payment recorded successfully", data: bill };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update payments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Mark paid error:", error);
    return { success: false, message: "Failed to update payment" };
  }
}
