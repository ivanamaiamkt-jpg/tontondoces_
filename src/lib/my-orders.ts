// "Meus pedidos": o aparelho guarda os códigos (ids) dos pedidos feitos nele e pede ao banco só
// esses pedidos. Antes qualquer pessoa podia ver os pedidos de qualquer telefone; agora o código
// do pedido (aleatório, impossível de adivinhar) é a chave — igual ao link do motoboy.
import { supabase } from "@/integrations/supabase/client";

const KEY = "tonton_meus_pedidos";
const MAX = 50;

export function rememberOrderId(id: string) {
  try {
    const cur = getRememberedOrderIds().filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify([id, ...cur].slice(0, MAX)));
  } catch {
    // sem armazenamento (aba anônima etc.): o pedido continua valendo, só não aparece em "Meus pedidos"
  }
}

export function getRememberedOrderIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Busca pedidos pelos códigos (a função do banco devolve só os campos que a tela usa). */
export async function fetchOrdersByIds<T>(ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = (await supabase.rpc("orders_by_ids" as never, {
    p_ids: ids,
  } as never)) as unknown as { data: T[] | null; error: unknown };
  if (error) {
    console.error("orders_by_ids:", error);
    return [];
  }
  return data ?? [];
}
