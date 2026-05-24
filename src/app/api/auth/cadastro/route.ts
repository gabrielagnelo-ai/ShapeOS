import { NextResponse, type NextRequest } from "next/server";
import { createSessionCookieValue, hashPassword, sessionCookieName, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function redirectTo(request: NextRequest, path: string, message?: string) {
  const url = new URL(path, request.url);
  if (message) url.searchParams.set("erro", message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    return redirectTo(request, "/cadastro", "Preencha nome, email e uma senha com pelo menos 8 caracteres.");
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return redirectTo(request, "/cadastro", "Esse email já está cadastrado.");
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const token = createSessionCookieValue(user.id, expiresAt);
    const response = redirectTo(request, "/onboarding");
    response.cookies.set(sessionCookieName, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    console.error("[auth] route sign up failed", error);
    return redirectTo(request, "/cadastro", "Não foi possível criar a conta agora. Verifique a configuração do banco e tente novamente.");
  }
}
