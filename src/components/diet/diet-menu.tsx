import { CalendarDays, Plus } from "lucide-react";
import { addDietMenuEntryAction } from "@/app/dieta/menu-actions";
import dietStyles from "@/app/dieta/diet.module.css";
import { ShoppingListExport } from "@/components/diet/shopping-list-export";
import { ShoppingItems, shoppingExportLines } from "@/components/diet/shopping-items";
import { IconTile } from "@/components/ui/group";
import { SubmitButton } from "@/components/ui/submit-button";
import { MacroRings } from "@/components/today/today-cards";
import sections from "@/components/ui/sections.module.css";
import { MAX_MENU_ENTRIES, MENU_DAYS_WARNING_THRESHOLD, MENU_ENTRY_MAX_DAYS, MENU_ENTRY_MIN_DAYS, type ConsolidatedShoppingItem } from "@/lib/diet-menu";
import { MenuEntryDaysField, MenuEntryMoveButtons, MenuEntryRemoveButton } from "./diet-menu-controls";
import styles from "./diet-menu.module.css";

export type DietMenuEntryView = {
  id: string;
  planName: string;
  days: number;
  kcalPerDay: number;
  isActivePlan: boolean;
};

type Macros = { kcal: number; protein: number; carbs: number; fat: number };

const STATUS: Record<string, { text: string; tone: "ok" | "warn" }> = {
  added: { text: "Plano adicionado ao cardápio.", tone: "ok" },
  days: { text: "Dias atualizados.", tone: "ok" },
  moved: { text: "Ordem atualizada.", tone: "ok" },
  removed: { text: "Plano removido do cardápio.", tone: "ok" },
  "invalid-days": { text: "Os dias precisam ser um número inteiro de 1 a 90.", tone: "warn" },
  "invalid-plan": { text: "Escolha um dos seus planos para adicionar.", tone: "warn" },
  full: { text: `O cardápio aceita até ${MAX_MENU_ENTRIES} planos. Remova um antes de adicionar outro.`, tone: "warn" },
  "not-found": { text: "Esse item não está mais no cardápio. A lista foi atualizada.", tone: "warn" },
};

export function DietMenuView({ entries, plans, average, targets, totalDays, exceedsMonth, shopping, status }: {
  entries: DietMenuEntryView[];
  plans: { id: string; name: string }[];
  average: Macros;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
  totalDays: number;
  exceedsMonth: boolean;
  shopping: { items: ConsolidatedShoppingItem[]; estimatedCost: number; missingPriceCount: number };
  status?: string;
}) {
  const message = status ? STATUS[status] : undefined;
  const macros = [
    { label: "Calorias", value: average.kcal, target: targets.calories, unit: "kcal", color: "#eef0eb" },
    { label: "Proteínas", value: average.protein, target: targets.proteinG, unit: "g", color: "#77cce9" },
    { label: "Carboidratos", value: average.carbs, target: targets.carbsG, unit: "g", color: "#b9f83e" },
    { label: "Gorduras", value: average.fat, target: targets.fatG, unit: "g", color: "#f7c744" },
  ];
  const planCount = entries.length;
  const full = planCount >= MAX_MENU_ENTRIES;

  return <div className={styles.stack}>
    <section className={sections.section} aria-labelledby="cardapio-title">
      <div className={styles.head}>
        <IconTile icon={CalendarDays} colour="orange" />
        <div>
          <h2 id="cardapio-title">Cardápio</h2>
          <p className={styles.headNote}>
            {planCount ? <>{totalDays} {totalDays === 1 ? "dia" : "dias"} · {planCount} {planCount === 1 ? "plano" : "planos"}</> : "Planos em sequência para o mês"}
          </p>
        </div>
      </div>
      {exceedsMonth ? <p className={styles.monthWarning}>Passa de {MENU_DAYS_WARNING_THRESHOLD} dias: a lista cobre mais de um mês.</p> : null}
      <div role="status" aria-live="polite">
        {message ? <p className={styles.status} data-tone={message.tone}>{message.text}</p> : null}
      </div>

      {planCount ? <>
        <div className={styles.average} aria-label="Média por dia do cardápio">
          <div className={dietStyles.calories}>
            <MacroRings
              className={styles.rings}
              rings={macros.map((macro) => ({ pct: macro.value / Math.max(1, macro.target) * 100, color: macro.color }))}
              value={Math.round(average.kcal).toLocaleString("pt-BR")}
              caption="kcal por dia, em média"
              label={macros.map((macro) => `${macro.label}: média de ${Math.round(macro.value)} de ${macro.target} ${macro.unit} por dia`).join("; ")}
            />
          </div>
          <div className={dietStyles.macros}>
            {macros.map((macro) => <div key={macro.label}>
              <div><span>{macro.label}</span><strong>{Math.round(macro.value).toLocaleString("pt-BR")} <small>/ {macro.target.toLocaleString("pt-BR")} {macro.unit} por dia</small></strong></div>
              <progress max={Math.max(1, macro.target)} value={macro.value} aria-label={`${macro.label}: média de ${Math.round(macro.value)} de ${macro.target} ${macro.unit} por dia`} />
            </div>)}
          </div>
        </div>

        <ol className={styles.entries} aria-label="Planos do cardápio, em ordem">
          {entries.map((entry, index) => <li key={entry.id} className={styles.entry}>
            <span className={styles.order} aria-hidden="true">{index + 1}</span>
            <div className={styles.entryMain}>
              <p className={styles.entryName}>{entry.planName}</p>
              <p className={styles.entryMeta}>{Math.round(entry.kcalPerDay).toLocaleString("pt-BR")} kcal por dia{entry.isActivePlan ? " · Ativo" : ""}</p>
            </div>
            <div className={styles.entryControls}>
              <MenuEntryDaysField key={entry.days} entryId={entry.id} days={entry.days} planName={entry.planName} />
              <div className={styles.entryActions}>
                <MenuEntryMoveButtons entryId={entry.id} planName={entry.planName} isFirst={index === 0} isLast={index === entries.length - 1} />
                <MenuEntryRemoveButton entryId={entry.id} planName={entry.planName} />
              </div>
            </div>
          </li>)}
        </ol>
      </> : <p className={styles.empty}>
        Junte dois ou mais planos, cada um por alguns dias, para ter a lista de compras do mês com refeições variadas. Exemplo: plano 1 por 7 dias, plano 2 por 7 dias e plano 3 por 15 dias.
      </p>}

      {plans.length ? <form action={addDietMenuEntryAction} className={styles.addForm}>
        <p className={styles.addTitle}>{planCount ? "Adicionar outro plano" : "Adicionar o primeiro plano"}</p>
        <div className={styles.addFields}>
          <label className={styles.planField}>
            <span>Plano</span>
            <select name="planId" required defaultValue={plans[0].id} disabled={full}>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
          <label className={styles.daysField}>
            <span>Dias</span>
            <input name="days" type="number" inputMode="numeric" enterKeyHint="done" min={MENU_ENTRY_MIN_DAYS} max={MENU_ENTRY_MAX_DAYS} step={1} required defaultValue={7} disabled={full} />
          </label>
          <SubmitButton disabled={full} pendingLabel="Adicionando…" className={`${styles.addButton}`}>
            <Plus size={17} aria-hidden="true" />
            Adicionar
          </SubmitButton>
        </div>
        {full ? <p className={styles.addHint}>O cardápio está com {MAX_MENU_ENTRIES} planos, o máximo. Remova um para adicionar outro.</p> : null}
      </form> : <p className={styles.empty}>
        Você ainda não tem planos. Crie um em <a href="#planos">Meus planos</a> e volte aqui para montar o cardápio.
      </p>}
    </section>

    {planCount ? <section className={sections.section} aria-labelledby="cardapio-compras">
      <div className={sections.heading}>
        <div>
          <h2 id="cardapio-compras">Lista de compras do cardápio</h2>
          <p>{totalDays} {totalDays === 1 ? "dia" : "dias"} somados, com as mesmas conversões da aba Compras</p>
        </div>
      </div>
      <ShoppingListExport title={`Lista de compras ShapeOS - Cardápio (${totalDays} dias)`} items={shoppingExportLines(shopping.items)} />
      <ShoppingItems
        items={shopping.items}
        estimatedCost={shopping.estimatedCost}
        missingPriceCount={shopping.missingPriceCount}
        costLabel="Custo estimado do cardápio"
        emptyText="Os planos do cardápio ainda não têm alimentos."
      />
    </section> : null}
  </div>;
}
