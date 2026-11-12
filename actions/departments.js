"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";

export async function createDepartment(data) {
  try {
    const { user } = await guardAction("departments", "create");

    const existing = await prisma.department.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return { success: false, message: "Department with this name already exists" };
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description || null,
        status: data.status || "ACTIVE",
      },
    });

    revalidatePath("/departments");
    revalidatePath("/dashboard");
    return { success: true, message: "Department created successfully", data: department };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create departments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create department error:", error);
    return { success: false, message: "Failed to create department" };
  }
}

export async function updateDepartment(id, data) {
  try {
    const { user } = await guardAction("departments", "update");

    const existing = await prisma.department.findFirst({
      where: { name: data.name, NOT: { id } },
    });

    if (existing) {
      return { success: false, message: "Department with this name already exists" };
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        status: data.status,
      },
    });

    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { success: true, message: "Department updated successfully", data: department };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update departments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update department error:", error);
    return { success: false, message: "Failed to update department" };
  }
}

export async function deleteDepartment(id) {
  try {
    const { user } = await guardAction("departments", "delete");

    const doctorCount = await prisma.doctor.count({
      where: { departmentId: id },
    });

    if (doctorCount > 0) {
      return {
        success: false,
        message: `Cannot delete department with ${doctorCount} doctor(s). Reassign them first.`,
      };
    }

    await prisma.department.delete({ where: { id } });

    revalidatePath("/departments");
    revalidatePath("/dashboard");
    return { success: true, message: "Department deleted successfully" };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to delete departments" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Delete department error:", error);
    return { success: false, message: "Failed to delete department" };
  }
}

export async function getDepartments({ search, status, page = 1, limit = 10 } = {}) {
  try {
    const { user } = await guardAction("departments", "read");

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        include: { _count: { select: { doctors: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.department.count({ where }),
    ]);

    return {
      success: true,
      data: departments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get departments error:", error);
    return { success: false, message: "Failed to fetch departments" };
  }
}

export async function getDepartmentById(id) {
  try {
    const { user } = await guardAction("departments", "read");

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        doctors: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { doctors: true } },
      },
    });

    if (!department) {
      return { success: false, message: "Department not found" };
    }

    return { success: true, data: department };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get department error:", error);
    return { success: false, message: "Failed to fetch department" };
  }
}

export async function getAllDepartments() {
  try {
    const { user } = await guardAction("departments", "read");

    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    });

    return { success: true, data: departments };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get all departments error:", error);
    return { success: false, message: "Failed to fetch departments" };
  }
}
