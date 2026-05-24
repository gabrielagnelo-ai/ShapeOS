import { NextResponse } from "next/server";
import { generateGeminiCoachBriefing } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  const body = await request.json();
  const briefing = await generateGeminiCoachBriefing(body);

  return NextResponse.json(briefing);
}
