// Promoção "2 por R$ 40,00" nos copos grandes: 1 copo custa R$ 25,00 e cada 2 copos saem por
// R$ 40,00 (desconto de R$ 10,00 por par). Para mudar ou desligar a promoção é só mexer aqui
// (e no preço dos copos em menu-data.ts).

/** Copos grandes que entram na promoção (qualquer mistura de sabores conta). */
export const PAIR_PROMO_PRODUCT_IDS = [
  "copo-doce-encanto",
  "copo-nevadinho",
  "copo-pecado-em-dobro",
  "copo-prazer-em-camadas",
  "copo-merengue",
  "copo-doce-paixao",
  "inspiracao-ferreiro-250",
];

/** Preço de 1 copo e preço de cada par, em reais. */
export const PAIR_PROMO_UNIT_PRICE = 25;
export const PAIR_PROMO_PAIR_PRICE = 40;

const DISCOUNT_PER_PAIR = PAIR_PROMO_UNIT_PRICE * 2 - PAIR_PROMO_PAIR_PRICE;

export const PAIR_PROMO_LABEL = "2 por R$ 40,00";

type LineLike = { productId: string; quantity: number };

/** Desconto em reais: R$ 10,00 para cada 2 copos grandes no carrinho. */
export function computePairDiscount(items: LineLike[]): number {
  const units = items
    .filter((it) => PAIR_PROMO_PRODUCT_IDS.includes(it.productId))
    .reduce((s, it) => s + it.quantity, 0);
  return Math.floor(units / 2) * DISCOUNT_PER_PAIR;
}
