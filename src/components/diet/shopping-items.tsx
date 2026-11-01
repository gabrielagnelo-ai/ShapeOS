import { shoppingItemCost, type ConsolidatedShoppingItem } from "@/lib/diet-menu";
import { wholeEggUnitCount, wholeEggUnitPrice } from "@/lib/shopping-list";
import styles from "@/app/dieta/diet.module.css";

export function formatShoppingWeight(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2).replace(".", ",")} kg`;
  return `${Math.round(grams)} g`;
}

export function formatEggUnits(grams: number) {
  const units = wholeEggUnitCount(grams);
  return `${units} ${units === 1 ? "ovo" : "ovos"}`;
}

/** What to buy, in one phrase: eggs in units, raw food marked "Comprar cru" (same place for all). */
export function shoppingQuantity(item: ConsolidatedShoppingItem) {
  if (item.isWholeChickenEgg) return formatEggUnits(item.buyGrams);
  return `${item.unitLabel === "cru" ? "Comprar cru: " : ""}${formatShoppingWeight(item.buyGrams)}`;
}

/** One line per item for the copy, share and download export. */
export function shoppingExportLines(items: ConsolidatedShoppingItem[]) {
  return items.map((item) => `${item.name} - ${shoppingQuantity(item)}`);
}

export function itemsLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** The answer of the list: estimated total and how many items have a price. */
export function ShoppingSummary({ items, estimatedCost, missingPriceCount, costLabel }: {
  items: ConsolidatedShoppingItem[];
  estimatedCost: number;
  missingPriceCount: number;
  costLabel: string;
}) {
  if (!items.length) return null;
  if (estimatedCost <= 0) return <p className="text-sm text-text-muted">Sem preços cadastrados para estimar o custo.</p>;
  return <div>
    <p className="text-sm text-text-secondary">{missingPriceCount > 0 ? "Estimativa parcial" : costLabel}</p>
    <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-text-primary">{brl(estimatedCost)}</p>
    <p className="text-xs text-text-muted">{items.length - missingPriceCount} de {itemsLabel(items.length)} com preço</p>
  </div>;
}

/** The consolidated shopping list with conversions, prices and the estimated total. */
export function ShoppingItems({ items, estimatedCost, missingPriceCount, costLabel, emptyText, totalInHeader = false }: {
  items: ConsolidatedShoppingItem[];
  estimatedCost: number;
  missingPriceCount: number;
  costLabel: string;
  emptyText: string;
  /** The total is shown above the list (ShoppingSummary); the footer keeps only the missing-price note. */
  totalInHeader?: boolean;
}) {
  return <div className={styles.shoppingItems}>
    {items.map((item) => (
      <div key={item.name} className="rounded-2xl bg-surface-tertiary px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span>{item.name}</span>
          <span className="shrink-0 text-right font-medium tabular-nums">{shoppingQuantity(item)}</span>
        </div>
        {item.unitLabel === "cru" ? (
          <div className="mt-1 space-y-1 text-xs text-text-muted">
            <p>Necessário pronto: {formatShoppingWeight(item.plannedReadyGrams)}</p>
            {item.isLeanCookedPorkLeg ? <p>Quantidade ajustada considerando osso, gordura removida e perda no cozimento.</p> : null}
          </div>
        ) : null}
        {item.isWholeChickenEgg ? (
          <p className="mt-1 text-xs text-text-muted">Conversão: 1 ovo = aproximadamente 53 g.</p>
        ) : null}
        {item.pricePerKg != null ? (
          <p className="mt-1 text-xs text-text-muted">
            {item.isWholeChickenEgg ? `R$ ${wholeEggUnitPrice(item.pricePerKg).toFixed(2).replace(".", ",")}/unidade - ` : ""}
            Estimado: R$ {shoppingItemCost(item).toFixed(2).replace(".", ",")}
          </p>
        ) : <p className="mt-1 text-xs text-warning">Sem preço · fora da estimativa</p>}
      </div>
    ))}
    {!items.length ? <p className="text-text-muted">{emptyText}</p> : null}
    {totalInHeader ? (
      missingPriceCount > 0 ? <p className="text-xs leading-5 text-text-muted">{itemsLabel(missingPriceCount)} sem preço {missingPriceCount === 1 ? "fica" : "ficam"} fora da estimativa. O total da compra será maior.</p> : null
    ) : estimatedCost > 0 ? (
      <div className="font-semibold">
        {missingPriceCount > 0 ? "Estimativa parcial" : costLabel}: {estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        <p className="mt-1 text-xs font-normal text-text-muted">{items.length - missingPriceCount} de {itemsLabel(items.length)} com preço.{missingPriceCount > 0 ? " O total da compra será maior ao incluir os itens faltantes." : " Valores podem variar por marca e mercado."}</p>
      </div>
    ) : (
      items.length ? <p className="text-xs leading-5 text-text-muted">Preencha os preços dos alimentos para estimar o custo da lista.</p> : null
    )}
  </div>;
}
