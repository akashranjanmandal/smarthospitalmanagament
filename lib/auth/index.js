import { getAuthPayload, setAuthCookie, clearAuthCookie } from "./jwt";
import { prisma, withTransaction } from "@/lib/prisma";
import { enforceSuperAdmin } from "./super-admin";
import { writeAudit } from "@/lib/audit/extension";

export { getAuthPayload, setAuthCookie, clearAuthCookie };

export async function getCurrentUser() {
  const payload = await getAuthPayload();
  if (!payload) return null;

  try {
    let user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { patient: true, doctor: true },
    });
    user = await enforceSuperAdmin(prisma, user);
    return user;
  } catch (error) {
    console.error("getCurrentUser DB error:", error.message || error);
    return null;
  }
}

export async function getCurrentUserRole() {
  const user = await getCurrentUser();
  return user?.role || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(...roles) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

export async function ensureUser() {
  const payload = await getAuthPayload();
  if (!payload) return null;

  try {
    let user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { patient: true, doctor: true },
    });

    if (!user) return null;

    if (user.role === "PATIENT" && !user.patient) {
      await prisma.patient.create({
        data: {
          userId: user.id,
          firstName: user.firstName || "Patient",
          lastName: user.lastName || "",
          gender: "OTHER",
          dateOfBirth: new Date("2000-01-01"),
          phone: "0000000000",
        },
      });
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { patient: true, doctor: true },
      });
    }

    return user;
  } catch (error) {
    console.error("ensureUser DB error:", error.message || error);
    return null;
  }
}

export async function authenticateUser(emailInput, password) {
  const bcrypt = await import("bcryptjs");
  const email = emailInput?.toLowerCase()?.trim();
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    omit: { password: false },
  });

  if (!user || !user.password) {
    await writeAudit(prisma, { action: "LOGIN_FAILED", entity: "User", entityId: user?.id ?? null, actorId: null, changes: { email } });
    return null;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await writeAudit(prisma, { action: "LOGIN_FAILED", entity: "User", entityId: user.id, actorId: null, changes: { email } });
    return null;
  }
  delete user.password;
  await writeAudit(prisma, { action: "LOGIN", entity: "User", entityId: user.id, actorId: user.id, actorRole: user.role });

  user = await enforceSuperAdmin(prisma, user);
  await setAuthCookie(user.id, user.email, user.role, user.profileComplete !== false);
  return user;
}

export async function registerUser(data) {
  const bcrypt = await import("bcryptjs");
  const { isSuperAdminEmail } = await import("./super-admin");

  const email = data.email?.toLowerCase()?.trim();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) return { success: false, message: "Email already registered" };

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const isSuperAdmin = isSuperAdminEmail(data.email);
  const role = isSuperAdmin ? "SUPER_ADMIN" : data.role || "PATIENT";
  const phone = data.phone ? String(data.phone).replace(/\D/g, "") : null;

  // Staff roles are only granted with a valid registration code, checked here on the server.
  let registrationCode = null;
  if (!isSuperAdmin && role !== "PATIENT") {
    registrationCode = data.registrationCodeId
      ? await prisma.registrationCode.findUnique({ where: { id: String(data.registrationCodeId) } })
      : null;
    const usable =
      registrationCode &&
      registrationCode.status === "UNUSED" &&
      registrationCode.expiresAt > new Date() &&
      registrationCode.role === role;
    if (!usable) {
      return { success: false, message: "A valid registration code is required to sign up as staff" };
    }
  }

  let user;
  try {
    user = await withTransaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone,
          phoneVerified: false,
          role,
          profileComplete: true,
          city: data.city || null,
          registrationCodeId: registrationCode?.id || null,
          // Staff join the branch their registration code was issued for; patients and the
          // super admin are never branch-scoped.
          branchId: registrationCode?.branchId || null,
        },
      });

      if (registrationCode) {
        // Conditional update so two sign-ups racing on one code can't both succeed.
        const claimed = await tx.registrationCode.updateMany({
          where: { id: registrationCode.id, status: "UNUSED" },
          data: { status: "USED", usedById: created.id },
        });
        if (claimed.count !== 1) throw new Error("REGISTRATION_CODE_USED");

        if (role === "DOCTOR" && registrationCode.departmentId) {
          await tx.doctor.create({
            data: { userId: created.id, departmentId: registrationCode.departmentId, phone },
          });
        }
      }

      if (created.role === "PATIENT") {
        await tx.patient.create({
          data: {
            userId: created.id,
            firstName: data.firstName || "Patient",
            lastName: data.lastName || "",
            gender: data.gender || "OTHER",
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date("2000-01-01"),
            phone: phone || "0000000000",
            address: data.city || data.address || null,
            bloodGroup: data.bloodGroup || null,
            emergencyContact: data.emergencyContact || null,
          },
        });
      }

      return created;
    });
  } catch (error) {
    if (error.message === "REGISTRATION_CODE_USED") {
      return { success: false, message: "A valid registration code is required to sign up as staff" };
    }
    throw error;
  }

  await setAuthCookie(user.id, user.email, user.role, user.profileComplete);
  return {
    success: true,
    message: "Registration successful",
    user,
    needsProfile: user.role === "PATIENT" && !user.profileComplete,
  };
}
