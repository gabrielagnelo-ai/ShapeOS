import Link from "next/link";
import { Lock, Mail, User } from "lucide-react";
import { AuthCard, AuthField } from "@/components/auth/auth-card";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Crie sua conta para salvar perfil, metas, dieta e evolução no ShapeOS."
      error={erro}
      footer={<>Já tem conta? <Link className="text-lime-300" href="/login">Entrar</Link></>}
    >
      <form action="/api/auth/cadastro" method="post" className="grid gap-4">
        <AuthField icon={User} label="Nome" name="name" placeholder="Seu nome completo" autoComplete="name" required />
        <AuthField icon={Mail} label="Email" name="email" type="email" placeholder="você@email.com" autoComplete="email" required />
        <AuthField icon={Lock} label="Senha" name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" required />
        <button className="mt-3 h-14 rounded-full bg-lime-300 px-5 text-base font-semibold text-black shadow-lg shadow-lime-950/30 transition hover:bg-lime-200 active:scale-[0.99]">
          Criar conta
        </button>
      </form>
    </AuthCard>
  );
}
