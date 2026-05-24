import { NextResponse } from "next/server";
import { getSessionStatus } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getSessionStatus();

    return NextResponse.json({
      authenticated: Boolean(status.user),
      reason: status.reason,
      hasCookie: status.hasCookie,
      hasSession: status.hasSession,
      userId: status.user?.id ?? null,
      userEmail: status.user?.email ?? null,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      directUrlConfigured: Boolean(process.env.DIRECT_URL),
      vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error("[auth] status failed", error);
    return NextResponse.json(
      {
        authenticated: false,
        reason: "status_error",
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
        directUrlConfigured: Boolean(process.env.DIRECT_URL),
        nodeEnv: process.env.NODE_ENV,
      },
      { status: 500 },
    );
  }
}
