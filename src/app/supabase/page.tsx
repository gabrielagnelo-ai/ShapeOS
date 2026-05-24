import { createClient } from "@/utils/supabase/server";

export default async function SupabaseStatusPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
        <p className="text-sm text-lime-300">Supabase</p>
        <h1 className="mt-3 text-3xl font-semibold">Conexao configurada</h1>
        <p className="mt-4 text-zinc-400">
          O cliente SSR foi inicializado com as variaveis publicas e o middleware esta pronto para refresh de sessao.
        </p>
        <div className="mt-6 rounded-2xl bg-black/30 p-4 text-sm text-zinc-300">
          Usuario atual: {data.user?.email ?? "nenhuma sessao ativa"}
        </div>
      </div>
    </main>
  );
}
