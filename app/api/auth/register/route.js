import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

export async function POST(req) {
  try {
    const data = await req.json();

    if (!data.email || !data.password) {
      return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 });
    }

    if (data.password.length < 6) {
      return NextResponse.json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 });
    }

    const result = await registerUser(data);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: { id: result.user.id, email: result.user.email, role: result.user.role, firstName: result.user.firstName, lastName: result.user.lastName },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ success: false, message: "Registration failed" }, { status: 500 });
  }
}
