import type { NextRequest } from "next/server";
import { getUserBySessionToken, sessionCookieName } from "@/lib/auth";

export async function getApiUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  const cookieToken = request.cookies.get(sessionCookieName)?.value;

  return getUserBySessionToken(bearerToken ?? cookieToken);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
