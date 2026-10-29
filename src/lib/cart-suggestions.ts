// "Que tal acrescentar?" no carrinho: sugestões de produtos que entram com um toque, em rodízio
// por dia (a ordem muda todo dia pra ela testar o que vende mais). A lista e o modo vêm de Admin > Configurações.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Product } from "@/lib/menu-data";
import { getAvailabilityState } from "@/lib/product-availability";

export type SuggestionMode = "rodizio" | "fixo";

/** Sugestões padrão: as opções mais baratas (as que têm sabor abrem a escolha do sabor). */
export const DEFAULT_SUGGESTION_POOL = [
  "gourmet-brig-oreo",
  "gourmet-brig-ninho-oreo",
  "geladinho-gourmet",
  "promo-copo-150",
  "art-brownie",
  "art-camafeu",
  "morango-cravejado-tradicional",
  "gourmet-espetinho-uva-ninho",
];

// O carrinho mostra as sugestões num carrossel (deslizar pro lado), então cabem várias.
const SHOWN = 8;

/** Pode ser sugerido: entra direto ou depois de escolher UM sabor. Ficam de fora os combos de
 * vários sabores e o que pede agendamento/quantidade mínima. */
export function isSuggestible(p: Product): boolean {
  return !p.flavorPicks && !p.requiresScheduling && !p.minQuantity;
}

export function allSuggestibleProducts(): Product[] {
  return CATEGORIES.flatMap((c) => c.products).filter(isSuggestible);
}

/** Dia local como número, pra o rodízio mudar à meia-noite do horário de Brasília. */
function dayNumber(now = new Date()): number {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Escolhe as sugestões: tira o que já está no carrinho, o esgotado e o arquivado. */
export function pickSuggestions(opts: {
  pool: string[];
  mode: SuggestionMode;
  cartProductIds: string[];
  unavailable: Set<string>;
  now?: Date;
}): Product[] {
  const byId = new Map(allSuggestibleProducts().map((p) => [p.id, p]));
  const valid = opts.pool.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  const free = (p: Product) => !opts.cartProductIds.includes(p.id) && !opts.unavailable.has(p.id);
  // O rodízio gira sobre a lista toda (e não só sobre o que sobrou), assim as sugestões não
  // "embaralham" quando o cliente acrescenta uma delas: só entra a próxima da fila.
  const start = opts.mode === "fixo" || valid.length === 0 ? 0 : dayNumber(opts.now) % valid.length;
  const out: Product[] = [];
  for (let i = 0; i < valid.length && out.length < SHOWN; i++) {
    const p = valid[(start + i) % valid.length];
    if (free(p)) out.push(p);
  }
  return out;
}

type Settings = { pool: string[]; mode: SuggestionMode };

let pending: Promise<Settings> | null = null;

async function fetchSettings(): Promise<Settings> {
  const fallback: Settings = { pool: DEFAULT_SUGGESTION_POOL, mode: "rodizio" };
  try {
    const { data } = (await supabase
      .from("store_settings" as never)
      .select("key,value")
      .in("key", ["cart_suggestions", "cart_suggestions_mode"])) as unknown as {
      data: { key: string; value: string }[] | null;
    };
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    let pool = fallback.pool;
    const raw = map.get("cart_suggestions");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) pool = parsed;
    }
    return { pool, mode: map.get("cart_suggestions_mode") === "fixo" ? "fixo" : "rodizio" };
  } catch {
    return fallback;
  }
}

/** Sugestões de hoje para o carrinho atual. */
export function useCartSuggestions(cartProductIds: string[]): Product[] {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    pending ??= fetchSettings();
    pending.then((s) => alive && setSettings(s));
    getAvailabilityState()
      .then((s) => alive && setUnavailable(new Set([...s.soldOut, ...s.archived])))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!settings) return [];
  return pickSuggestions({
    pool: settings.pool,
    mode: settings.mode,
    cartProductIds,
    unavailable,
  });
}
