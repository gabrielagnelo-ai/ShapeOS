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

/** One line per item for the copy, share and download export. */
export function shoppingExportLines(items: ConsolidatedShoppingItem[]) {
  return items.map((item) => {
    const quantity = item.isWholeChickenEgg
      ? formatEggUnits(item.buyGrams)
      : `${item.isLeanCookedPorkLeg ? "Comprar cru: " : ""}${formatShoppingWeight(item.buyGrams)}`;
    return `${item.name} - ${quantity}`;
  });
}

/** The consolidated shopping list with conversions, prices and the estimated total. */
export function ShoppingItems({ items, estimatedCost, missingPriceCount, costLabel, emptyText }: {
  items: ConsolidatedShoppingItem[];
  estimatedCost: number;
  missingPriceCount: number;
  costLabel: string;
  emptyText: string;
}) {
  return <div className={styles.shoppingItems}>
    {items.map((item) => (
      <div key={item.name} className="rounded-2xl bg-surface-tertiary px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span>{item.name}</span>
          <span className="font-medium tabular-nums">
            {item.isWholeChickenEgg
              ? formatEggUnits(item.buyGrams)
              : <>{item.isLeanCookedPorkLeg ? "Comprar cru: " : ""}{formatShoppingWeight(item.buyGrams)}</>}
          </span>
        </div>
        {item.isLeanCookedPorkLeg ? (
          <div className="mt-1 space-y-1 text-xs text-text-muted">
            <p>Necessário pronto: {formatShoppingWeight(item.plannedReadyGrams)}</p>
            <p>Quantidade ajustada considerando osso, gordura removida e perda no cozimento.</p>
          </div>
        ) : item.unitLabel === "cru" ? (
          <p className="mt-1 text-xs text-text-muted">
            Comprar cru. O plano mostra {formatShoppingWeight(item.plannedReadyGrams)} já pronto para comer.
          </p>
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
    {estimatedCost > 0 ? (
      <div className="font-semibold">
        {missingPriceCount > 0 ? "Estimativa parcial" : costLabel}: {estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        <p className="mt-1 text-xs font-normal text-text-muted">{items.length - missingPriceCount} de {items.length} itens com preço.{missingPriceCount > 0 ? " O total da compra será maior ao incluir os itens faltantes." : " Valores podem variar por marca e mercado."}</p>
      </div>
    ) : (
      items.length ? <p className="text-xs leading-5 text-text-muted">Preencha os preços dos alimentos para estimar o custo da lista.</p> : null
    )}
  </div>;
}
