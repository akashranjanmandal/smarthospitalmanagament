import { NextResponse } from "next/server";
import { runEscalationBatch } from "@/actions/feedback";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    // This route is public to the proxy, so it must always be protected by CRON_SECRET
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, message: "Unauthorized cron trigger" }, { status: 401 });
    }

    const result = await runEscalationBatch();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron escalation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during escalation batch" },
      { status: 500 }
    );
  }
}
