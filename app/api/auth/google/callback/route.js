import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

const COOKIE_NAME = "shds-auth-token";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/sign-in?error=no_code", req.url));
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || url.origin}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Google OAuth token error:", tokenData);
      return NextResponse.redirect(new URL("/sign-in?error=token_failed", req.url));
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/sign-in?error=no_email", req.url));
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      include: { doctor: true, patient: true },
    });

    if (!user) {
      const isSuperAdmin = isSuperAdminEmail(googleUser.email);
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          firstName: googleUser.given_name || "User",
          lastName: googleUser.family_name || "",
          imageUrl: googleUser.picture || null,
          role: isSuperAdmin ? "SUPER_ADMIN" : "PATIENT",
          profileComplete: true,
          ...(isSuperAdmin
            ? {}
            : {
                patient: {
                  create: {
                    firstName: googleUser.given_name || "Patient",
                    lastName: googleUser.family_name || "",
                    gender: "OTHER",
                    dateOfBirth: new Date("2000-01-01"),
                    phone: "0000000000",
                  },
                },
              }),
        },
        include: { patient: true },
      });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileComplete: !!user.profileComplete,
    });

    const target =
      user.role === "PATIENT" && !user.profileComplete
        ? "/complete-profile"
        : "/dashboard";

    const response = NextResponse.redirect(new URL(target, req.url));
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", req.url));
  }
}
