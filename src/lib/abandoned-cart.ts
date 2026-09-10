import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/contexts/order-context";

const SESSION_KEY = "tonton_session_id";

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type SyncArgs = {
  nome: string;
  telefone?: string;
  items: CartItem[];
  status?: "ativo" | "convertido" | "notificado";
};

export async function syncAbandonedCart({ nome, telefone, items, status = "ativo" }: SyncArgs) {
  const trimmed = (nome ?? "").trim();
  if (trimmed.length < 2 || items.length === 0) return;
  const session_id = getSessionId();
  if (!session_id) return;

  const itens = items.map((it) => ({
    nome: it.productName,
    quantidade: it.quantity,
    preco_unitario: it.unitPrice,
    preco_total: it.unitPrice * it.quantity,
  }));
  const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const cleanPhone = (telefone ?? "").replace(/\D/g, "");

  try {
    await (supabase.from("carrinhos_abandonados" as never).upsert(
      {
        session_id,
        nome: trimmed,
        telefone: cleanPhone || null,
        itens,
        total,
        status,
        atualizado_em: new Date().toISOString(),
      } as never,
      { onConflict: "session_id" } as never,
    ));
  } catch (e) {
    console.error("syncAbandonedCart error:", e);
  }
}

export async function markCartConverted() {
  const session_id = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  if (!session_id) return;
  try {
    await (supabase
      .from("carrinhos_abandonados" as never)
      .update({ status: "convertido", atualizado_em: new Date().toISOString() } as never)
      .eq("session_id", session_id));
  } catch (e) {
    console.error("markCartConverted error:", e);
  }
}
