import type { Product } from "@/lib/menu-data";

/**
 * Preço pra mostrar no cartão: se os sabores têm preços diferentes mostra o menor com "a partir de"
 * (antes o cartão mostrava só o preço base e o valor subia depois que o cliente escolhia o sabor).
 * Combos têm preço fixo, independente do sabor. Opções esgotadas não entram na conta.
 */
export function priceFrom(
  p: Product,
  soldOutOptions?: Set<string>,
): { from: number; varies: boolean } {
  const isCombo = p.id.startsWith("combo-");
  const open = p.flavors?.filter((f) => !soldOutOptions?.has(f.id));
  const flavors = open?.length ? open : p.flavors;
  const prices =
    !isCombo && flavors?.length
      ? flavors.map((f) => (typeof f.price === "number" ? f.price : p.price))
      : [p.price];
  const from = Math.min(...prices);
  return { from, varies: prices.some((v) => v !== from) };
}
