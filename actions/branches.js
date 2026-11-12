"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { branchScope } from "@/lib/branch-scope";

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "Only the super admin can manage branches" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(fallback, error);
  return { success: false, message: fallback };
}

/** CHAIN-like short code from a name: letters/digits only, first 4, upper-cased, de-duplicated. */
async function uniqueBranchCode(name) {
  const base = (name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4) || "BR").toUpperCase();
  for (let n = 0; ; n++) {
    const candidate = n === 0 ? base : `${base}${n}`;
    if (!(await prisma.branch.findUnique({ where: { code: candidate }, select: { id: true } }))) return candidate;
  }
}

export async function createBranch(data) {
  try {
    await guardAction("branches", "create");
    const name = data.name?.trim();
    if (!name) return { success: false, message: "Enter the branch name" };

    if (await prisma.branch.findUnique({ where: { name } })) {
      return { success: false, message: "A branch with this name already exists" };
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        code: data.code?.trim().toUpperCase() || (await uniqueBranchCode(name)),
        city: data.city?.trim() || null,
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
      },
    });

    revalidatePath("/admin/branches");
    return { success: true, message: "Branch created", data: branch };
  } catch (error) {
    return failed(error, "Failed to create branch");
  }
}

export async function updateBranch(id, data) {
  try {
    await guardAction("branches", "update");

    if (data.name) {
      const clash = await prisma.branch.findFirst({ where: { name: data.name.trim(), NOT: { id } } });
      if (clash) return { success: false, message: "A branch with this name already exists" };
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        city: data.city?.trim() || null,
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        status: data.status,
      },
    });

    revalidatePath("/admin/branches");
    return { success: true, message: "Branch updated", data: branch };
  } catch (error) {
    return failed(error, "Failed to update branch");
  }
}

/** Every branch for the super admin; a branch admin sees only their own. */
export async function getBranches() {
  try {
    const { user } = await guardAction("branches", "read");
    const branches = await prisma.branch.findMany({
      where: branchScope(user, "id"),
      orderBy: { name: "asc" },
      include: { _count: { select: { staff: true, departments: true, wards: true } } },
    });
    return { success: true, data: branches };
  } catch (error) {
    return failed(error, "Failed to load branches");
  }
}
