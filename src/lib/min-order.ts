import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Valor usado até o painel responder (ou se não houver ajuste salvo). */
export const DEFAULT_MIN_ORDER = 15;

let pending: Promise<number> | null = null;

async function fetchMinOrder(): Promise<number> {
  try {
    const { data } = (await supabase
      .from("store_settings" as never)
      .select("value")
      .eq("key", "min_order")
      .maybeSingle()) as unknown as { data: { value: string } | null };
    const n = Number(String(data?.value ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_ORDER;
  } catch {
    return DEFAULT_MIN_ORDER;
  }
}

/** Pedido mínimo em reais, editável em Admin > Configurações. */
export function useMinOrder(): number {
  const [value, setValue] = useState(DEFAULT_MIN_ORDER);

  useEffect(() => {
    let alive = true;
    pending ??= fetchMinOrder();
    pending.then((n) => {
      if (alive) setValue(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return value;
}
