import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { canAccessRoute } from "@/lib/permissions";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "shds-default-secret-change-in-production");
const COOKIE_NAME = "shds-auth-token";

// /api/cron authenticates itself with CRON_SECRET instead of a login cookie.
const publicPaths = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/api/auth", "/api/cron", "/forbidden"];

function isPublicPath(pathname) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function getPayloadFromRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.purpose ? null : payload; // scoped tickets are not sessions
  } catch {
    return null;
  }
}

// The site has no public landing page: "/" and the sign-in / sign-up screens route by session.
const ENTRY_PAGES = ["/", "/sign-in", "/sign-up"];

function isEntryPage(pathname) {
  return ENTRY_PAGES.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
}

// Where each role starts: the kiosk device on the kiosk, the insurance desk on its worklist, everyone else on the dashboard.
const HOME = { KIOSK: "/kiosk", INSURANCE_DESK: "/insurance", PHARMACIST: "/pharmacy", LAB_TECH: "/lab", KITCHEN: "/kitchen" };
const homeFor = (role) => HOME[role] ?? "/dashboard";

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (isEntryPage(pathname)) {
    const payload = await getPayloadFromRequest(request);
    if (payload) return NextResponse.redirect(new URL(homeFor(payload.role), request.url));
    if (pathname === "/") return NextResponse.redirect(new URL("/sign-in", request.url));
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const payload = await getPayloadFromRequest(request);

  if (!payload) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Roles with their own start screen never see the general dashboard.
  if (pathname === "/dashboard" && HOME[payload.role]) {
    return NextResponse.redirect(new URL(HOME[payload.role], request.url));
  }

  // Force incomplete patient profiles to onboarding
  if (
    payload.role === "PATIENT" &&
    payload.profileComplete === false &&
    !pathname.startsWith("/complete-profile") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/complete-profile", request.url));
  }

  // Keep users off pages their role can't use (server actions enforce the same rules on the data).
  if (!pathname.startsWith("/api/") && !canAccessRoute(payload.role, pathname)) {
    // A kiosk device is simply returned to the kiosk screen.
    return NextResponse.redirect(new URL(payload.role === "KIOSK" ? "/kiosk" : "/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
