import { CalendarDays } from "lucide-react";
import dietStyles from "@/app/dieta/diet.module.css";
import { ShoppingListExport } from "@/components/diet/shopping-list-export";
import { ShoppingItems, ShoppingSummary, shoppingExportLines } from "@/components/diet/shopping-items";
import { IconTile } from "@/components/ui/group";
import { MacroRings } from "@/components/today/today-cards";
import sections from "@/components/ui/sections.module.css";
import { MENU_DAYS_WARNING_THRESHOLD, type ConsolidatedShoppingItem } from "@/lib/diet-menu";
import { MenuAddForm, MenuEntryRow, MenuListStatus, type MenuEntryRowData } from "./diet-menu-controls";
import styles from "./diet-menu.module.css";

export type DietMenuEntryView = MenuEntryRowData;

type Macros = { kcal: number; protein: number; carbs: number; fat: number };

const daysLabel = (days: number) => `${days} ${days === 1 ? "dia" : "dias"}`;

export function DietMenuView({ entries, plans, average, targets, totalDays, exceedsMonth, shopping }: {
  entries: DietMenuEntryView[];
  plans: { id: string; name: string }[];
  average: Macros;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
  totalDays: number;
  exceedsMonth: boolean;
  shopping: { items: ConsolidatedShoppingItem[]; estimatedCost: number; missingPriceCount: number };
}) {
  const macros = [
    { label: "Calorias", value: average.kcal, target: targets.calories, unit: "kcal", color: "#eef0eb" },
    { label: "Proteínas", value: average.protein, target: targets.proteinG, unit: "g", color: "#77cce9" },
    { label: "Carboidratos", value: average.carbs, target: targets.carbsG, unit: "g", color: "#b9f83e" },
    { label: "Gorduras", value: average.fat, target: targets.fatG, unit: "g", color: "#f7c744" },
  ];
  const planCount = entries.length;

  return <div className={styles.stack}>
    <section className={sections.section} aria-labelledby="cardapio-title">
      <div className={styles.head}>
        <IconTile icon={CalendarDays} colour="orange" />
        <div>
          <h2 id="cardapio-title">{planCount ? `${daysLabel(totalDays)} · ${planCount} ${planCount === 1 ? "plano" : "planos"}` : "Monte seu cardápio"}</h2>
          {exceedsMonth ? <p className={styles.monthWarning}>Passa de {MENU_DAYS_WARNING_THRESHOLD} dias: a lista cobre mais de um mês.</p> : null}
        </div>
      </div>

      {planCount ? <>
        <div className={styles.average}>
          <div className={dietStyles.calories}>
            <MacroRings
              className={styles.rings}
              rings={macros.map((macro) => ({ pct: macro.value / Math.max(1, macro.target) * 100, color: macro.color }))}
              value={Math.round(average.kcal).toLocaleString("pt-BR")}
              caption="kcal por dia"
              label={macros.map((macro) => `${macro.label}: média de ${Math.round(macro.value)} de ${macro.target} ${macro.unit} por dia`).join("; ")}
            />
          </div>
          <div>
            <p className={styles.averageTitle}>Média por dia</p>
            <div className={dietStyles.macros}>
              {macros.map((macro) => <div key={macro.label}>
                <div><span>{macro.label}</span><strong>{Math.round(macro.value).toLocaleString("pt-BR")} <small>/ {macro.target.toLocaleString("pt-BR")} {macro.unit}</small></strong></div>
                <progress max={Math.max(1, macro.target)} value={macro.value} aria-label={`${macro.label}: média de ${Math.round(macro.value)} de ${macro.target} ${macro.unit} por dia`} />
              </div>)}
            </div>
          </div>
        </div>

        <MenuListStatus signature={entries.map((entry) => entry.id).join(",")} />
        <ol className={styles.entries} aria-label="Planos do cardápio, em ordem">
          {entries.map((entry, index) => <MenuEntryRow key={entry.id} entry={entry} index={index} count={planCount} />)}
        </ol>
      </> : <>
        <MenuListStatus signature="" />
        <p className={styles.empty}>
          Junte dois ou mais planos, cada um por alguns dias, para ter a lista de compras do mês com refeições variadas. Exemplo: plano 1 por 7 dias, plano 2 por 7 dias e plano 3 por 15 dias.
        </p>
      </>}

      {plans.length ? <MenuAddForm plans={plans} planCount={planCount} /> : <p className={styles.empty}>
        Você ainda não tem planos. Crie um em <a href="#planos">Meus planos</a> e volte aqui para montar o cardápio.
      </p>}
    </section>

    {planCount ? <section className={sections.section} aria-labelledby="cardapio-compras">
      <div className={styles.listHead}>
        <div>
          <h2 id="cardapio-compras">Lista de compras</h2>
          <p className={styles.listNote}>Para {daysLabel(totalDays)}</p>
        </div>
        <ShoppingSummary items={shopping.items} estimatedCost={shopping.estimatedCost} missingPriceCount={shopping.missingPriceCount} costLabel="Custo estimado" />
      </div>
      <ShoppingListExport title={`Lista de compras ShapeOS - Cardápio (${totalDays} dias)`} items={shoppingExportLines(shopping.items)} />
      <ShoppingItems
        items={shopping.items}
        estimatedCost={shopping.estimatedCost}
        missingPriceCount={shopping.missingPriceCount}
        costLabel="Custo estimado"
        emptyText="Os planos do cardápio ainda não têm alimentos."
        totalInHeader
      />
    </section> : null}
  </div>;
}
