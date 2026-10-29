import type { Product } from "@/lib/menu-data";

/**
 * Preço pra mostrar no cartão: se os sabores têm preços diferentes mostra o menor com "a partir de"
 * (antes o cartão mostrava só o preço base e o valor subia depois que o cliente escolhia o sabor).
 * Combos têm preço fixo, independente do sabor.
 */
export function priceFrom(p: Product): { from: number; varies: boolean } {
  const isCombo = p.id.startsWith("combo-");
  const prices =
    !isCombo && p.flavors?.length
      ? p.flavors.map((f) => (typeof f.price === "number" ? f.price : p.price))
      : [p.price];
  const from = Math.min(...prices);
  return { from, varies: prices.some((v) => v !== from) };
}
