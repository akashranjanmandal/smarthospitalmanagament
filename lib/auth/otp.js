import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { setAuthCookie } from "@/lib/auth/jwt";

export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

export function isValidIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export async function createAndStoreOtp(phone) {
  const normalized = normalizePhone(phone);
  if (!isValidIndianPhone(normalized)) {
    return { success: false, message: "Enter a valid 10-digit mobile number" };
  }

  // The fixed dev code (and echoing it back) is only for local development; production uses a random code.
  const isProduction = process.env.NODE_ENV === "production";
  const code = isProduction
    ? String(crypto.randomInt(0, 1000000)).padStart(6, "0")
    : process.env.OTP_STATIC_CODE || "123456";
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpCode.updateMany({
    where: { phone: normalized, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: { phone: normalized, code, expiresAt },
  });

  return {
    success: true,
    message: "OTP sent successfully",
    phone: normalized,
    ...(isProduction ? {} : { devCode: code }),
  };
}

/** Check and use up a phone OTP without signing anyone in (used by sign-in and by the kiosk). */
export async function consumeOtp(phone, otp) {
  const normalized = normalizePhone(phone);
  if (!isValidIndianPhone(normalized)) {
    return { success: false, message: "Enter a valid 10-digit mobile number" };
  }
  if (!otp || String(otp).length < 4) {
    return { success: false, message: "Enter a valid OTP" };
  }

  const record = await prisma.otpCode.findFirst({
    where: {
      phone: normalized,
      code: String(otp).trim(),
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { used: true },
  });
  return { success: true, phone: normalized };
}

export async function verifyPhoneOtp(phone, otp) {
  const check = await consumeOtp(phone, otp);
  if (!check.success) return check;
  const normalized = check.phone;

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: normalized }, { email: `${normalized}@phone.local` }],
    },
    include: { patient: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: normalized,
        phoneVerified: true,
        email: `${normalized}@phone.local`,
        role: "PATIENT",
        firstName: "Patient",
        lastName: "",
        profileComplete: false,
        patient: {
          create: {
            firstName: "Patient",
            lastName: "",
            gender: "OTHER",
            dateOfBirth: new Date("2000-01-01"),
            phone: normalized,
          },
        },
      },
      include: { patient: true },
    });
  } else if (!user.phoneVerified || !user.phone) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phone: normalized, phoneVerified: true },
      include: { patient: true },
    });
  }

  if (user.role === "PATIENT" && !user.patient) {
    await prisma.patient.create({
      data: {
        userId: user.id,
        firstName: user.firstName || "Patient",
        lastName: user.lastName || "",
        gender: "OTHER",
        dateOfBirth: new Date("2000-01-01"),
        phone: normalized,
      },
    });
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: { patient: true },
    });
  }

  await setAuthCookie(
    user.id,
    user.email || `${normalized}@phone.local`,
    user.role,
    user.profileComplete
  );

  return {
    success: true,
    message: "Phone verified successfully",
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileComplete: user.profileComplete,
    },
    needsProfile: user.role === "PATIENT" && !user.profileComplete,
  };
}

export async function completePatientProfile(userId, data) {
  const firstName = String(data.firstName || "").trim();
  const lastName = String(data.lastName || "").trim();
  const city = String(data.city || "").trim();
  const rawEmail = String(data.email || "").trim().toLowerCase();
  const gender = data.gender;
  const dateOfBirth = data.dateOfBirth;

  if (!firstName || !gender || !dateOfBirth) {
    return { success: false, message: "Name, gender and date of birth are required" };
  }

  const isRealEmail = rawEmail && !rawEmail.endsWith("@phone.local");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      city: city || null,
      email: isRealEmail ? rawEmail : undefined,
      profileComplete: true,
    },
  });

  const { setAuthCookie } = await import("@/lib/auth/jwt");
  await setAuthCookie(user.id, user.email, user.role, true);

  const existingPatient = await prisma.patient.findUnique({ where: { userId } });
  if (existingPatient) {
    await prisma.patient.update({
      where: { userId },
      data: {
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        phone: existingPatient.phone || user.phone || "0000000000",
        address: city || existingPatient.address,
        bloodGroup: data.bloodGroup || existingPatient.bloodGroup,
        emergencyContact: data.emergencyContact || existingPatient.emergencyContact,
      },
    });
  } else {
    await prisma.patient.create({
      data: {
        userId,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        phone: user.phone || "0000000000",
        address: city || null,
        bloodGroup: data.bloodGroup || null,
        emergencyContact: data.emergencyContact || null,
      },
    });
  }

  return {
    success: true,
    message: "Profile completed successfully",
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileComplete: true,
    },
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
