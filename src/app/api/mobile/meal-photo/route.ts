import type { NextRequest } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  if (!(await getApiUser(request))) return unauthorized();
  return Response.json({
    error: "feature_removed",
    message: "O reconhecimento de refeições por foto foi desativado. Registre alimentos e porções no diário.",
  }, { status: 410 });
}
