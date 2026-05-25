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
  const wantsJson = request.headers.get("accept")?.includes("application/json") || request.headers.get("content-type")?.includes("application/json");
  const input = wantsJson ? await request.json().catch(() => ({})) : await request.formData();
  const email = String(input instanceof FormData ? input.get("email") ?? "" : input.email ?? "").trim().toLowerCase();
  const password = String(input instanceof FormData ? input.get("password") ?? "" : input.password ?? "");

  if (!email || !password) {
    if (wantsJson) return Response.json({ error: "Informe email e senha." }, { status: 400 });
    return redirectTo(request, "/login", "Informe email e senha.");
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      if (wantsJson) return Response.json({ error: "Email ou senha invalidos." }, { status: 401 });
      return redirectTo(request, "/login", "Email ou senha inválidos.");
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const token = createSessionCookieValue(user.id, expiresAt);
    const response = wantsJson
      ? NextResponse.json({
          token,
          expiresAt: expiresAt.toISOString(),
          user: { id: user.id, name: user.name, email: user.email },
        })
      : redirectTo(request, "/dashboard");
    response.cookies.set(sessionCookieName, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    console.error("[auth] route login failed", error);
    if (wantsJson) return Response.json({ error: "Nao foi possivel entrar agora." }, { status: 500 });
    return redirectTo(request, "/login", "Não foi possível entrar agora. Verifique a configuração do banco e tente novamente.");
  }
}
