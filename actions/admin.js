"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { SUPER_ADMIN_EMAIL, ROLES } from "@/lib/roles";

export async function promoteToSuperAdmin(targetEmail) {
  try {
    const { user } = await guardAction("departments", "create");
    if (user.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: "Only the super admin can promote users" };
    }

    const target = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!target) {
      return { success: false, message: "User not found" };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { role: ROLES.SUPER_ADMIN, profileComplete: true },
    });

    revalidatePath("/dashboard");
    return { success: true, message: `${targetEmail} is now a super admin` };
  } catch (error) {
    if (error.message === "Forbidden" || error.message === "Unauthorized") {
      return { success: false, message: "You do not have permission to promote users" };
    }
    console.error("Promote error:", error);
    return { success: false, message: "Failed to promote user" };
  }
}
