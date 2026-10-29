// Brinde por valor do pedido: a partir de R$ 60 (editável em Admin > Configurações) o cliente ganha
// um mimo. O cliente só vê "brinde"; o que é (mini brownie recheado) aparece só pra loja, no painel.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const GIFT_PRODUCT_ID = "brinde-mini-brownie";
/** Nome que o cliente vê. */
export const GIFT_LABEL = "Brinde da casa";
/** Nome que só a loja vê (painel de pedidos). */
export const GIFT_INTERNAL_LABEL = "Brinde: mini brownie recheado";

export const DEFAULT_GIFT_MIN = 60;

let pending: Promise<number> | null = null;

async function fetchGiftMin(): Promise<number> {
  try {
    const { data } = (await supabase
      .from("store_settings" as never)
      .select("value")
      .eq("key", "gift_min")
      .maybeSingle()) as unknown as { data: { value: string } | null };
    if (data?.value === undefined || data?.value === null || data.value === "") return DEFAULT_GIFT_MIN;
    const n = Number(String(data.value).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GIFT_MIN;
  } catch {
    return DEFAULT_GIFT_MIN;
  }
}

/** Valor mínimo do pedido pra ganhar o brinde (0 = brinde desligado). */
export function useGiftMin(): number {
  const [value, setValue] = useState(DEFAULT_GIFT_MIN);

  useEffect(() => {
    let alive = true;
    pending ??= fetchGiftMin();
    pending.then((n) => {
      if (alive) setValue(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return value;
}

/** Linha que entra no pedido (items) quando o cliente ganhou o brinde. */
export function giftOrderItem() {
  return {
    lineId: "brinde",
    productId: GIFT_PRODUCT_ID,
    productName: GIFT_LABEL,
    unitPrice: 0,
    quantity: 1,
    flavorLabels: [] as string[],
    via: "brinde",
  };
}
