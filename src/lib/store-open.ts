// "Fechar a loja" pelo painel: Configurações > "Loja aberta?" (store_open) e "Mensagem quando fechada"
// (closed_message). O site confere a cada minuto; fechada à mão vale acima do horário da semana.
// Fechada = o site mostra "Fechado" e a mensagem, mas o cliente ainda consegue fazer o pedido
// (igual a fora do horário).
import { useEffect, useReducer } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoreStatus, type StoreClosure, type StoreStatus } from "@/lib/store-hours";

let closure: StoreClosure = { closed: false, message: "" };
const listeners = new Set<() => void>();
let poll: ReturnType<typeof setInterval> | null = null;

/** Devolve null se a consulta falhar: quem chama mantém o estado que já tinha. */
export async function fetchStoreClosure(): Promise<StoreClosure | null> {
  try {
    const { data, error } = (await supabase
      .from("store_settings" as never)
      .select("key,value")
      .in("key", ["store_open", "closed_message"])) as unknown as {
      data: { key: string; value: string | null }[] | null;
      error: unknown;
    };
    if (error || !data) return null;
    const map = new Map(data.map((r) => [r.key, r.value ?? ""]));
    return { closed: map.get("store_open") === "false", message: (map.get("closed_message") ?? "").trim() };
  } catch {
    return null;
  }
}

/** Já vem resolvido no HTML (loader da página), pra não piscar "Aberto" antes de carregar. */
export function seedStoreClosure(next: StoreClosure | null | undefined) {
  if (next) closure = next;
}

async function refresh() {
  const next = await fetchStoreClosure();
  if (!next || (next.closed === closure.closed && next.message === closure.message)) return;
  closure = next;
  listeners.forEach((l) => l());
}

export function useStoreStatus(): StoreStatus & { message: string } {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    void refresh();
    if (!poll) poll = setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(rerender, 60_000);
    return () => {
      listeners.delete(rerender);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
      if (listeners.size === 0 && poll) {
        clearInterval(poll);
        poll = null;
      }
    };
  }, []);
  return { ...getStoreStatus(new Date(), closure), message: closure.message };
}
