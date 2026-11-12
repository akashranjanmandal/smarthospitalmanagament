import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, imageUrl: user.imageUrl },
  });
}
