"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { MacroRings, WaterCard } from "./today-cards";

// Only mounted by the development-only component preview. No persistence or server actions.
export function MotionPreview() {
  const [water, setWater] = useState(1000);
  const [progress, setProgress] = useState(62);
  return <div className="mt-6 grid gap-6 md:grid-cols-2">
    <GlassCard>
      <h2 className="text-xl font-semibold">Anéis de exemplo</h2>
      <div className="my-5 flex justify-center"><MacroRings value={`${progress}%`} caption="exemplo" label={`Progresso de exemplo: ${progress}%`} rings={[{pct:progress,color:"#f5f5f7"},{pct:progress*.8,color:"#7dd3fc"},{pct:progress*.9,color:"#b8ff00"},{pct:progress*.65,color:"#fbbf24"}]} /></div>
      <label className="grid gap-3 text-sm text-zinc-300">Progresso demonstrativo<input type="range" min="0" max="100" value={progress} onChange={(event)=>setProgress(Number(event.target.value))} /></label>
    </GlassCard>
    <WaterCard consumedMl={water} targetMl={2800} detail="Exemplo local para testar a transição. Não altera registros da conta." stats={[]} actions={<>
      <button type="button" className="rounded-full bg-sky-300/15 px-4 text-sky-100" onClick={()=>setWater(Math.min(2800,water+250))}>Simular +250 ml</button>
      <button type="button" className="rounded-full bg-fill px-4 text-text-primary hover:bg-fill-strong" onClick={()=>setWater(0)}>Zerar exemplo</button>
    </>} />
  </div>;
}
