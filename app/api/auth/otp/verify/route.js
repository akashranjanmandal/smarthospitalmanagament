import { NextResponse } from "next/server";
import { verifyPhoneOtp } from "@/lib/auth/otp";

export async function POST(req) {
  try {
    const { phone, otp } = await req.json();
    const result = await verifyPhoneOtp(phone, otp);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ success: false, message: "OTP verification failed" }, { status: 500 });
  }
}
