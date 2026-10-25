import { useId, type CSSProperties, type ReactNode } from "react";
import { Check, Droplets, Dumbbell, Moon, Plus, Utensils, Zap, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GroupRow, IconTile, type TileColour } from "@/components/ui/group";
import { Hero } from "@/components/ui/screen";
import { WaterVessel } from "@/components/water/water-vessel";
import type { BodyEnergy, NextTraining, SleepSummary, TodayMeal } from "@/lib/today";

const fmt = (n: number, digits = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")} min`;

export function CardTitle({ icon, tile = "gray", title, aside }: { icon: LucideIcon; tile?: TileColour; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} colour={tile} />
      <h2 className="text-h4">{title}</h2>
      {aside ? <div className="ml-auto">{aside}</div> : null}
    </div>
  );
}

export function SourceTag({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap text-caption text-text-muted">{children}</span>;
}

/** One strip of figures divided by hairlines, instead of a box per figure. */
function FigureStrip({ items, columns }: { items: { label: string; value: ReactNode; detail?: ReactNode }[]; columns: string }) {
  return (
    <dl className={`grid overflow-hidden rounded-[14px] bg-surface-tertiary ${columns}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-3 py-2.5 shadow-[-1px_0_0_var(--hairline),0_-1px_0_var(--hairline)]">
          <dt className="text-caption text-text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-body font-semibold tabular-nums">{item.value}</dd>
          {item.detail ? <dd className="text-caption font-normal text-text-muted">{item.detail}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

// ---------- anéis de calorias e macros ----------
const RINGS = [
  { r: 98, w: 14 },
  { r: 79, w: 12 },
  { r: 62, w: 12 },
  { r: 45, w: 12 },
];

export function MacroRings({ rings, value, caption, label, className }: { rings: { pct: number; color: string }[]; value: string; caption: string; label: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`macro-rings relative aspect-square w-44 shrink-0 sm:w-52 ${className ?? ""}`} role="img" aria-label={label}>
      <svg viewBox="0 0 220 220" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          {rings.map((ring, i) => <linearGradient key={i} id={`${id}-ring-${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={ring.color} /><stop offset=".7" stopColor={ring.color} /><stop offset="1" stopColor="#fff" stopOpacity=".85" /></linearGradient>)}
        </defs>
        {rings.map((ring, i) => {
          const { r, w } = RINGS[i];
          const length = 2 * Math.PI * r;
          return (
            <g key={i}>
              <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={w} />
              <circle
                cx="110" cy="110" r={r} fill="none" stroke={`url(#${id}-ring-${i})`} strokeWidth={w} strokeLinecap="round" opacity={ring.pct > 0 ? 1 : 0}
                strokeDasharray={length} strokeDashoffset={length * (1 - Math.min(1, ring.pct / 100))}
                className="ring-arc" style={{ "--ring-length": length } as CSSProperties}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <b className="block text-[26px] font-bold leading-7 tracking-[-0.03em] tabular-nums">{value}</b>
          <span className="mx-auto block max-w-16 text-[11px] leading-[13px] text-text-muted">{caption}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- nutrição ----------
type Macro = { label: string; color: string; consumed: number; target: number; unit: string };

/** Hoje's hero: the day's consumption against the goals, and the one thing to do next. */
export function NutritionHero({
  lead, macros, action,
}: {
  lead: ReactNode;
  macros: Macro[];
  action?: ReactNode;
}) {
  const [kcal] = macros;
  const remaining = Math.max(0, Math.round(kcal.target - kcal.consumed));
  return (
    <Hero aria-label="Nutrição de hoje">
      <p className="max-w-2xl text-headline text-text-primary">{lead}</p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <MacroRings
          rings={macros.map((m) => ({ pct: m.target ? (m.consumed / m.target) * 100 : 0, color: m.color }))}
          value={fmt(remaining)}
          caption="kcal restantes"
          label={macros.map((m) => `${m.label}: ${fmt(m.consumed)} de ${fmt(m.target)} ${m.unit}`).join("; ")}
        />
        <ul className="grid w-full gap-3.5">
          {macros.map((m) => {
            const pct = m.target ? Math.min(100, Math.round((m.consumed / m.target) * 100)) : 0;
            return (
              <li key={m.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5 text-body-sm">
                <span className="flex items-center gap-2 text-text-secondary"><span className="size-2 rounded-full" style={{ background: m.color }} />{m.label}</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">{fmt(m.consumed)} <span className="font-normal text-text-muted">/ {fmt(m.target)} {m.unit}</span></span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-fill"><span className="macro-fill block h-full w-full origin-left rounded-full" style={{ transform: `scaleX(${pct / 100})`, background: m.color }} /></span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-4 text-right text-caption font-normal text-text-muted">Valores da Tabela TACO</p>

      {action ? <div className="mt-5 border-t border-hairline pt-5">{action}</div> : null}
    </Hero>
  );
}

/** Today's meals as an inset grouped list (iOS): logged or planned, with the energy of each. */
export function TodayMeals({ meals }: { meals: TodayMeal[] }) {
  return (
    <div className="material overflow-hidden">
      <div className="px-4 pt-4"><CardTitle icon={Utensils} tile="orange" title="Refeições" /></div>
      <div className="mt-2">
        {meals.length ? meals.map((meal) => (
          <GroupRow
            key={meal.name}
            title={meal.name}
            subtitle={meal.status === "logged" ? "Registrada" : "Prevista no plano"}
            trailing={<>
              <span><b className="font-semibold tabular-nums text-text-primary">{fmt(meal.kcal)}</b> kcal</span>
              {meal.status === "logged" ? <Check size={16} className="text-success" aria-hidden="true" /> : null}
            </>}
          />
        )) : <p className="px-4 pb-4 text-body-sm text-text-muted">Nenhuma refeição registrada hoje. Registre a primeira para comparar com a meta.</p>}
      </div>
    </div>
  );
}

const ACTION_STYLES = {
  // Filled: the one main action of a view.
  primary: "bg-primary text-primary-foreground hover:bg-primary-light",
  // Tinted: an action of the brand inside a card.
  tinted: "bg-primary/15 text-primary hover:bg-primary/20",
  // Gray: neutral actions.
  gray: "bg-fill text-text-primary hover:bg-fill-strong",
} as const;

export function ActionLink({ href, children, variant = "gray", icon = false }: { href: string; children: ReactNode; variant?: keyof typeof ACTION_STYLES; icon?: boolean }) {
  return (
    <a href={href} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-body-sm font-semibold ${ACTION_STYLES[variant]}`}>
      {icon ? <Plus size={15} aria-hidden="true" /> : null}
      {children}
    </a>
  );
}

// ---------- água ----------
export function WaterCard({ consumedMl, targetMl, detail, stats, actions }: { consumedMl: number; targetMl: number; detail: string; stats: { label: string; value: string; detail: string }[]; actions: ReactNode }) {
  const pct = targetMl ? Math.min(100, Math.round((consumedMl / targetMl) * 100)) : 0;
  return (
    <GlassCard>
      <CardTitle icon={Droplets} tile="cyan" title="Água" aside={<span className="rounded-full bg-fill px-2.5 py-1 text-caption tabular-nums text-text-secondary">{pct}%</span>} />
      <div className="mt-4 flex items-center gap-4">
        <WaterVessel percent={pct} label={`${fmt(consumedMl / 1000, 1)} de ${fmt(targetMl / 1000, 1)} litros`} />
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[30px] font-bold leading-9 tracking-[-0.02em] tabular-nums">{fmt(consumedMl / 1000, 1)} L <span className="text-body-sm font-normal tracking-normal text-text-muted">de {fmt(targetMl / 1000, 1)} L</span></p>
          <p className="mt-1 text-body-sm text-text-muted">{detail}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
      <div className="mt-4">
        <FigureStrip columns="grid-cols-3" items={stats} />
      </div>
    </GlassCard>
  );
}

// ---------- sono ----------
function Bars({ values, max, color, labels }: { values: (number | null)[]; max: number; color: string; labels: string }) {
  return (
    <div className="flex h-12 items-end gap-1.5" role="img" aria-label={labels}>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-[4px]" style={{ height: `${v == null ? 8 : Math.max(10, Math.min(100, (v / max) * 100))}%`, background: v == null ? "rgba(255,255,255,0.08)" : color, opacity: i === values.length - 1 ? 1 : 0.55 }} />
      ))}
    </div>
  );
}

function HealthEmptyState({ checkin, label }: { checkin: number | null; label: string }) {
  return (
    <div className="mt-4">
      {checkin != null ? (
        <p className="text-[30px] font-bold leading-9 tracking-[-0.02em] tabular-nums">{checkin}<span className="text-body-sm font-normal tracking-normal text-text-muted">/10 no último check-in</span></p>
      ) : null}
      <p className="mt-2 text-body-sm text-text-muted">
        Sincronize o Apple Saúde pelo app do ShapeOS no iPhone para ver {label} aqui.
      </p>
    </div>
  );
}

export function SleepCard({ sleep, checkinSleep }: { sleep: SleepSummary | null; checkinSleep: number | null }) {
  return (
    <GlassCard>
      <CardTitle icon={Moon} tile="teal" title="Sono" aside={sleep ? <SourceTag>Apple Saúde</SourceTag> : null} />
      {sleep ? (
        <div className="mt-4">
          <p className="text-[30px] font-bold leading-9 tracking-[-0.02em] tabular-nums">{hours(sleep.lastNightMinutes)}</p>
          <p className="mt-1 text-body-sm text-text-muted">Média dos últimos 7 dias: {hours(sleep.averageMinutes)}</p>
          <div className="mt-4">
            <Bars values={sleep.nights} max={540} color="#f4f4f5" labels={`Sono nas últimas noites: ${sleep.nights.map((n) => (n == null ? "sem dado" : hours(n))).join(", ")}`} />
          </div>
        </div>
      ) : (
        <HealthEmptyState checkin={checkinSleep} label="horas de sono" />
      )}
    </GlassCard>
  );
}

// ---------- energia corporal ----------
export function EnergyCard({ energy, checkinEnergy }: { energy: BodyEnergy | null; checkinEnergy: number | null }) {
  return (
    <GlassCard>
      <CardTitle icon={Zap} tile="brand" title="Energia corporal" aside={energy ? <SourceTag>Apple Saúde</SourceTag> : null} />
      {energy ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <p className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">{energy.score}<span className="ml-1 text-body font-normal tracking-normal text-text-muted">/ 100</span></p>
            <div className="mt-3 flex w-40 gap-[3px]" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-sm ${i < Math.round(energy.score / 10) ? "bg-primary" : "bg-fill"}`} />)}
            </div>
            <p className="mt-2 text-body-sm font-semibold capitalize text-text-secondary">Energia {energy.level}</p>
          </div>
          <Bars values={energy.history.map((h) => h.score)} max={100} color="#b8ff00" labels={`Energia nos últimos dias: ${energy.history.map((h) => h.score).join(", ")}`} />
          <div className="sm:col-span-2">
            <FigureStrip columns="grid-cols-2 sm:grid-cols-4" items={[
              { label: "Recarga no sono", value: `+${energy.sleepRecharge}` },
              {
                label: "FC em repouso",
                value: energy.restingHeartRate ? `${energy.restingHeartRate.bpm} bpm` : "—",
                detail: energy.restingHeartRate?.vsAverage != null
                  ? <span className={energy.restingHeartRate.vsAverage > 0 ? "text-danger" : "text-success"}>{energy.restingHeartRate.vsAverage > 0 ? "+" : ""}{energy.restingHeartRate.vsAverage} vs. média</span>
                  : undefined,
              },
              { label: "Gasto com atividade", value: `−${energy.drain}` },
              { label: "Passos", value: energy.steps != null ? fmt(energy.steps) : "—" },
            ]} />
          </div>
          <p className="text-body-sm text-text-muted sm:col-span-2">Estimativa a partir de sono, frequência cardíaca de repouso e atividade sincronizados.</p>
        </div>
      ) : (
        <HealthEmptyState checkin={checkinEnergy} label="sua energia do dia" />
      )}
    </GlassCard>
  );
}

// ---------- treino ----------
export function TrainingCard({ next, week, performance }: { next: NextTraining | null; week: { date: Date; trained: boolean }[]; performance: { value: string; detail: string } }) {
  const weekdays = week.map((d) => d.date.toLocaleDateString("pt-BR", { weekday: "narrow", timeZone: "America/Sao_Paulo" }).toUpperCase());
  return (
    <GlassCard className="flex flex-col">
      <CardTitle icon={Dumbbell} tile="red" title="Próximo treino" />
      {next ? (
        <>
          <p className="mt-4 text-h3">{next.name}{next.focus ? `: ${next.focus}` : ""}</p>
          <p className="text-body-sm text-text-muted">{next.exerciseCount} exercício{next.exerciseCount === 1 ? "" : "s"}</p>
          <ul className="mt-3 divide-y divide-hairline">
            {next.exercises.map((e) => (
              <li key={e.name} className="grid grid-cols-[1fr_auto] gap-x-3 py-2.5 text-body">
                <span className="truncate">{e.name}</span>
                <b className="row-span-2 self-center text-right font-semibold tabular-nums">
                  {e.loadKg != null ? `${fmt(e.loadKg, e.loadKg % 1 ? 1 : 0)} kg` : "—"}
                  {e.loadDeltaKg ? <span className={`block text-caption ${e.loadDeltaKg > 0 ? "text-success" : "text-danger"}`}>{e.loadDeltaKg > 0 ? "+" : ""}{fmt(e.loadDeltaKg, 1)} kg</span> : null}
                </b>
                <span className="text-body-sm text-text-muted">{e.prescription ?? "Sem prescrição"}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-body-sm text-text-muted">Nenhum plano de treino ativo. Importe ou monte seu treino para acompanhar cargas e progressão.</p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="flex items-end gap-2">
          <div className="flex items-end gap-1" role="img" aria-label={`Treinos nos últimos 7 dias: ${week.filter((d) => d.trained).length}`}>
            {week.map((d, i) => (
              <span key={i} className="flex flex-col items-center gap-1">
                <span className={`block h-6 w-2 rounded-sm ${d.trained ? "bg-primary" : "bg-fill"}`} />
                <span className="text-[10px] text-text-muted" aria-hidden="true">{weekdays[i]}</span>
              </span>
            ))}
          </div>
          <p className="text-caption font-normal text-text-muted">Performance<br /><b className="font-semibold text-text-primary">{performance.value}</b> <span>{performance.detail}</span></p>
        </div>
        <ActionLink href="/treinos" variant={next ? "tinted" : "gray"}>{next ? "Abrir treino" : "Montar treino"}</ActionLink>
      </div>
    </GlassCard>
  );
}
