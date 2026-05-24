import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { AuthCard, AuthField } from "@/components/auth/auth-card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <AuthCard
      title="Entrar"
      subtitle="Acesse sua conta para continuar de onde parou."
      error={erro}
      footer={<>Ainda não tem conta? <Link className="text-lime-300" href="/cadastro">Criar conta</Link></>}
    >
      <form action="/api/auth/login" method="post" className="grid gap-4">
        <AuthField icon={Mail} label="Email" name="email" type="email" placeholder="você@email.com" autoComplete="email" required />
        <AuthField icon={Lock} label="Senha" name="password" type="password" placeholder="Sua senha" autoComplete="current-password" required />
        <button className="mt-3 h-14 rounded-full bg-lime-300 px-5 text-base font-semibold text-black shadow-lg shadow-lime-950/30 transition hover:bg-lime-200 active:scale-[0.99]">
          Entrar
        </button>
      </form>
    </AuthCard>
  );
}
