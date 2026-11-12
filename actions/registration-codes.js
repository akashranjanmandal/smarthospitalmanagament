"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import crypto from "crypto";
import { normalizeRegistrationCode } from "@/lib/registration-code";
import { branchScope, resolveBranchId, isChainWide } from "@/lib/branch-scope";

function generateCode(role) {
  const prefix = { ADMIN: "ADM", DOCTOR: "DOC", RECEPTIONIST: "REC", NURSE: "NUR", WARD_ATTENDANT: "WAT", KIOSK: "KSK", INSURANCE_DESK: "INS", PHARMACIST: "PHA", LAB_TECH: "LAB", KITCHEN: "KIT", PATIENT: "PAT" };
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix[role] || "STF"}-${part1}-${part2}`;
}

function generateEmployeeId(role) {
  const prefix = { ADMIN: "ADM", DOCTOR: "DOC", RECEPTIONIST: "REC", NURSE: "NUR", WARD_ATTENDANT: "WAT", KIOSK: "KSK", INSURANCE_DESK: "INS", PHARMACIST: "PHA", LAB_TECH: "LAB", KITCHEN: "KIT", PATIENT: "PAT" };
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0");
  return `${prefix[role] || "USR"}-${year}-${seq}`;
}

export async function generateRegistrationCode(data) {
  try {
    const { user } = await guardAction("departments", "create");

    if (data.role === "DOCTOR" && !data.departmentId) {
      return { success: false, message: "Select a department for doctor registration codes" };
    }
    if (data.role === "SUPER_ADMIN") {
      return { success: false, message: "The super admin role cannot be issued as a registration code" };
    }

    const branch = resolveBranchId(user, data.branchId);
    if (!branch.ok) return { success: false, message: branch.message };

    const code = generateCode(data.role);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

    const regCode = await prisma.registrationCode.create({
      data: {
        code,
        role: data.role,
        departmentId: data.departmentId || null,
        branchId: branch.branchId,
        expiresAt,
        createdById: user.id,
      },
      include: { createdBy: true },
    });

    revalidatePath("/admin/registration-codes");
    return { success: true, message: "Registration code generated", data: regCode };
  } catch (error) {
    if (error.message === "Forbidden") return { success: false, message: "Only administrators can generate registration codes" };
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Generate code error:", error);
    return { success: false, message: "Failed to generate registration code" };
  }
}

export async function getRegistrationCodes({ status, role, page = 1, limit = 20 } = {}) {
  try {
    const { user } = await guardAction("departments", "read");

    const where = { ...branchScope(user) };
    if (status && status !== "all") where.status = status;
    if (role && role !== "all") where.role = role;

    const [codes, total] = await Promise.all([
      prisma.registrationCode.findMany({
        where,
        include: { createdBy: true, usedBy: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.registrationCode.count({ where }),
    ]);

    return {
      success: true,
      data: codes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error" };
    console.error("Get codes error:", error);
    return { success: false, message: "Failed to fetch registration codes" };
  }
}

export async function revokeRegistrationCode(id) {
  try {
    const { user } = await guardAction("departments", "delete");

    const code = await prisma.registrationCode.findUnique({ where: { id } });
    if (!code || (!isChainWide(user.role) && code.branchId !== user.branchId)) return { success: false, message: "Code not found" };
    if (code.status === "USED") return { success: false, message: "Cannot revoke a code that has already been used" };

    await prisma.registrationCode.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    revalidatePath("/admin/registration-codes");
    return { success: true, message: "Registration code revoked" };
  } catch (error) {
    if (error.message === "Forbidden") return { success: false, message: "Only administrators can revoke codes" };
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error" };
    console.error("Revoke code error:", error);
    return { success: false, message: "Failed to revoke code" };
  }
}

export async function extendRegistrationCode(id, days) {
  try {
    const { user } = await guardAction("departments", "update");

    const code = await prisma.registrationCode.findUnique({ where: { id } });
    if (!code || (!isChainWide(user.role) && code.branchId !== user.branchId)) return { success: false, message: "Code not found" };
    if (code.status !== "UNUSED") return { success: false, message: "Can only extend unused codes" };

    const newExpiry = new Date(code.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + days);

    await prisma.registrationCode.update({
      where: { id },
      data: { expiresAt: newExpiry },
    });

    revalidatePath("/admin/registration-codes");
    return { success: true, message: `Code extended by ${days} days` };
  } catch (error) {
    if (error.message === "Forbidden") return { success: false, message: "Only administrators can extend codes" };
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error" };
    console.error("Extend code error:", error);
    return { success: false, message: "Failed to extend code" };
  }
}

export async function verifyRegistrationCode(code, expectedRole) {
  try {
    const regCode = await prisma.registrationCode.findUnique({
      where: { code: normalizeRegistrationCode(code) },
    });

    if (!regCode) return { valid: false, error: "Invalid registration code" };
    if (regCode.status === "USED") return { valid: false, error: "This code has already been used" };
    if (regCode.status === "REVOKED") return { valid: false, error: "This code has been revoked" };
    if (regCode.status === "EXPIRED") return { valid: false, error: "This code has expired" };
    if (new Date() > regCode.expiresAt) {
      await prisma.registrationCode.update({ where: { id: regCode.id }, data: { status: "EXPIRED" } });
      return { valid: false, error: "This code has expired" };
    }
    if (regCode.role !== expectedRole) return { valid: false, error: `This code is for ${regCode.role} role, not ${expectedRole}` };

    return { valid: true, codeId: regCode.id, role: regCode.role, departmentId: regCode.departmentId };
  } catch (error) {
    console.error("Verify code error:", error);
    return { valid: false, error: "Failed to verify code. Please try again." };
  }
}

export async function registerStaffWithCode(data) {
  try {
    const verification = await verifyRegistrationCode(data.code, data.role);
    if (!verification.valid) return { success: false, message: verification.error };

    const employeeId = generateEmployeeId(data.role);

    await prisma.registrationCode.update({
      where: { id: verification.codeId },
      data: { status: "USED" },
    });

    return {
      success: true,
      message: "Code verified. Complete your registration.",
      data: {
        registrationCodeId: verification.codeId,
        role: verification.role,
        departmentId: verification.departmentId,
        employeeId,
      },
    };
  } catch (error) {
    console.error("Register staff error:", error);
    return { success: false, message: "Registration failed. Please try again." };
  }
}

export async function completeStaffRegistration(data) {
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) return { success: false, message: "An account with this email already exists" };

    const user = await prisma.user.create({
      data: {
        clerkId: data.clerkId,
        email: data.email,
        employeeId: data.employeeId,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        registrationCodeId: data.registrationCodeId,
      },
    });

    if (data.role === "DOCTOR" && data.departmentId) {
      await prisma.doctor.create({
        data: {
          userId: user.id,
          departmentId: data.departmentId,
          specialization: data.specialization || "",
          qualification: data.qualification || "",
          phone: data.phone || "",
        },
      });
    }

    revalidatePath("/admin/registration-codes");
    return { success: true, message: "Registration complete", data: user };
  } catch (error) {
    console.error("Complete registration error:", error);
    return { success: false, message: "Registration failed. Please try again." };
  }
}

export async function generatePatientId() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0");
  return `PAT-${year}-${seq}`;
}
