import { NextResponse, type NextRequest } from "next/server";
import { createSessionCookieValue, sessionCookieName, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function redirectTo(request: NextRequest, path: string, message?: string) {
  const url = new URL(path, request.url);
  if (message) url.searchParams.set("erro", message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirectTo(request, "/login", "Informe email e senha.");
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return redirectTo(request, "/login", "Email ou senha inválidos.");
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const token = createSessionCookieValue(user.id, expiresAt);
    const response = redirectTo(request, "/dashboard");
    response.cookies.set(sessionCookieName, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    console.error("[auth] route login failed", error);
    return redirectTo(request, "/login", "Não foi possível entrar agora. Verifique a configuração do banco e tente novamente.");
  }
}
