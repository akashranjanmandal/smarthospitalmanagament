import { NextResponse } from "next/server";
import { createAndStoreOtp } from "@/lib/auth/otp";

export async function POST(req) {
  try {
    const { phone } = await req.json();
    const result = await createAndStoreOtp(phone);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json({ success: false, message: "Failed to send OTP" }, { status: 500 });
  }
}
