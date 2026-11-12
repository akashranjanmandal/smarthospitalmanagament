"use server";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const RESET_SENT_MESSAGE = "If an account exists for this email, a password reset link has been sent to it.";

export async function requestPasswordReset(email) {
  try {
    if (!email || typeof email !== "string") {
      return { success: false, message: "Please provide a valid email address" };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });

    // Same response whether or not the account exists, so this form can't be used to discover users.
    if (!user) {
      return { success: true, message: RESET_SENT_MESSAGE };
    }

    // Generate 32-byte secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Mark previous tokens for this email as used
    await prisma.passwordResetToken.updateMany({
      where: { email: cleanEmail, used: false },
      data: { used: true },
    });

    // Save token
    await prisma.passwordResetToken.create({
      data: {
        email: cleanEmail,
        token,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // Send email via Resend
    const emailResult = await sendPasswordResetEmail(user.email, resetUrl);

    if (!emailResult.success) {
      return { success: false, message: emailResult.message || "Failed to send reset email" };
    }

    return { success: true, message: RESET_SENT_MESSAGE };
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function resetPasswordWithToken({ token, newPassword }) {
  try {
    if (!token || typeof token !== "string") {
      return { success: false, message: "Invalid reset token" };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "Password must be at least 6 characters long" };
    }

    // Find token in database
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!tokenRecord || tokenRecord.used) {
      return {
        success: false,
        message: "This password reset link is invalid or has already been used.",
      };
    }

    if (new Date() > tokenRecord.expiresAt) {
      return {
        success: false,
        message: "This password reset link has expired (5-minute limit). Please request a new link.",
      };
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { email: { equals: tokenRecord.email, mode: "insensitive" } },
    });

    if (!user) {
      return { success: false, message: "User account not found." };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    return {
      success: true,
      message: "Your password has been reset successfully. Please sign in with your new password.",
    };
  } catch (error) {
    console.error("resetPasswordWithToken error:", error);
    return { success: false, message: "Failed to reset password. Please try again." };
  }
}
