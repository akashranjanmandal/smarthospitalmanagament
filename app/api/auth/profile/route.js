import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completePatientProfile } from "@/lib/auth/otp";

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const result = await completePatientProfile(user.id, data);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Profile complete error:", error);
    return NextResponse.json({ success: false, message: "Failed to save profile" }, { status: 500 });
  }
}
