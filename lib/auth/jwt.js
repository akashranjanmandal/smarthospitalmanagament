import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// A production deployment must set its own JWT_SECRET: every signed-in session, and every kiosk
// ticket, depends on it, so a missing one is refused outright rather than silently signing with a
// secret anyone can read in this file. Development and tests keep a fixed default for convenience.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Refusing to start in production without it.");
}
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "shds-default-secret-change-in-production");
const COOKIE_NAME = "shds-auth-token";

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

// Sign-in tokens never carry a "purpose"; scoped tokens (e.g. kiosk tickets) always do, so neither can stand in for the other.
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.purpose ? null : payload;
  } catch {
    return null;
  }
}

/** Short-lived token for one narrow purpose, e.g. a kiosk patient ticket. */
export async function signScopedToken(payload, expiresIn) {
  if (!payload?.purpose) throw new Error("Scoped tokens need a purpose");
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(SECRET);
}

export async function verifyScopedToken(token, purpose) {
  try {
    const { payload } = await jwtVerify(String(token ?? ""), SECRET);
    return payload.purpose === purpose ? payload : null;
  } catch {
    return null;
  }
}

export async function setAuthCookie(userId, email, role, profileComplete = true) {
  const token = await signToken({ userId, email, role, profileComplete: !!profileComplete });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
