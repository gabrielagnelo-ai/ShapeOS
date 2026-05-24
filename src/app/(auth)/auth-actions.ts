"use server";

import { redirect } from "next/navigation";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function authErrorUrl(path: "/login" | "/cadastro", message: string) {
  return `${path}?erro=${encodeURIComponent(message)}`;
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    redirect(authErrorUrl("/cadastro", "Preencha nome, email e uma senha com pelo menos 8 caracteres."));
  }

  let errorMessage: string | null = null;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      errorMessage = "Esse email já está cadastrado.";
    } else {
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
      });

      await createSession(user.id);
    }
  } catch (error) {
    console.error("[auth] sign up failed", error);
    errorMessage = "Não foi possível criar a conta agora. Verifique a configuração do banco e tente novamente.";
  }

  if (errorMessage) {
    redirect(authErrorUrl("/cadastro", errorMessage));
  }

  redirect("/onboarding");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(authErrorUrl("/login", "Informe email e senha."));
  }

  let errorMessage: string | null = null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      errorMessage = "Email ou senha inválidos.";
    } else {
      await createSession(user.id);
    }
  } catch (error) {
    console.error("[auth] sign in failed", error);
    errorMessage = "Não foi possível entrar agora. Verifique a configuração do banco e tente novamente.";
  }

  if (errorMessage) {
    redirect(authErrorUrl("/login", errorMessage));
  }

  redirect("/dashboard");
}
