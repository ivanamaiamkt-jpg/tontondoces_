import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/contexts/order-context";
import { getStoredUtm } from "@/lib/analytics";

const SESSION_KEY = "tonton_session_id";
const CONVERTED_KEY = "tonton_cart_converted";

/** Assinatura do carrinho (linhas + quantidades) — serve pra reconhecer um carrinho que já virou pedido. */
function cartSignature(items: CartItem[]) {
  return items.map((i) => `${i.lineId}:${i.quantity}`).join(",");
}

function rememberConverted(items: CartItem[]) {
  try {
    localStorage.setItem(CONVERTED_KEY, cartSignature(items));
  } catch {
    // ignore
  }
}

function isConverted(items: CartItem[]) {
  try {
    return localStorage.getItem(CONVERTED_KEY) === cartSignature(items);
  } catch {
    return false;
  }
}

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
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // sem armazenamento (aba anônima etc.): sem carrinho abandonado nesta visita
    return "";
  }
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
  // Carrinho que já virou pedido não volta a "ativo" (isso fazia quem comprou aparecer como abandonado).
  if (status === "ativo" && isConverted(items)) return;
  if (status === "convertido") rememberConverted(items);
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
    const utm = getStoredUtm();
    await supabase.rpc("sync_abandoned_cart" as never, {
      p_session: session_id,
      p_nome: trimmed,
      p_telefone: cleanPhone || null,
      p_itens: itens,
      p_total: total,
      p_status: status,
      p_utm_source: utm.utm_source,
      p_utm_medium: utm.utm_medium,
      p_utm_campaign: utm.utm_campaign,
    } as never);
  } catch (e) {
    console.error("syncAbandonedCart error:", e);
  }
}

export async function markCartConverted(items?: CartItem[]) {
  if (items) rememberConverted(items);
  const session_id = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  if (!session_id) return;
  try {
    await supabase.rpc("mark_cart_converted" as never, { p_session: session_id } as never);
  } catch (e) {
    console.error("markCartConverted error:", e);
  }
}
