// Desconto por par de copos grandes (ex.: "2 por R$ 40,00"). DESLIGADO por enquanto, já que o copo
// solto custa R$ 25,00 e o desconto vem só do Combo Date Doce. Está pronto para religar: basta
// preencher a lista de copos abaixo (o carrinho, o resumo do pedido, o WhatsApp e o painel já
// mostram o desconto quando existir).

/**
 * Copos grandes que entram na promoção. DESLIGADA no momento (lista vazia): o copo solto custa
 * R$ 25,00 e o desconto vem só do Combo Date Doce (cada copo a R$ 20,00 dentro do combo).
 * Para religar, coloque aqui os ids dos copos (ex.: "copo-doce-encanto"), ajuste os preços abaixo
 * e ponha a etiqueta no menu-data.ts.
 */
export const PAIR_PROMO_PRODUCT_IDS: string[] = [];

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
