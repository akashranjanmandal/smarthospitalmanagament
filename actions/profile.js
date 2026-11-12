"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setAuthCookie } from "@/lib/auth/jwt";
import { revalidatePath } from "next/cache";

export async function updateUserProfile(data) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const city = String(data.city || "").trim();
    const gender = data.gender;
    const dateOfBirth = data.dateOfBirth;
    const bloodGroup = data.bloodGroup;
    const emergencyContact = String(data.emergencyContact || "").trim();

    if (!firstName) {
      return { success: false, message: "First name is required" };
    }

    // Check if email is already taken by another account
    if (email && email !== user.email && !email.endsWith("@phone.local")) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== user.id) {
        return { success: false, message: "This email is already associated with another account" };
      }
    }

    const isRealEmail = email && !email.endsWith("@phone.local");

    // Update User record
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        email: isRealEmail ? email : user.email,
        city: city || null,
        profileComplete: true,
      },
    });

    // Update Patient record if present
    const patientRecord = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (patientRecord) {
      await prisma.patient.update({
        where: { userId: user.id },
        data: {
          firstName,
          lastName,
          address: city || patientRecord.address,
          gender: gender || patientRecord.gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : patientRecord.dateOfBirth,
          bloodGroup: bloodGroup || patientRecord.bloodGroup,
          emergencyContact: emergencyContact || patientRecord.emergencyContact,
        },
      });
    }

    // Refresh JWT session cookie
    await setAuthCookie(updatedUser.id, updatedUser.email, updatedUser.role, true);

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    };
  } catch (error) {
    console.error("updateUserProfile error:", error);
    return { success: false, message: error.message || "Failed to update profile" };
  }
}
