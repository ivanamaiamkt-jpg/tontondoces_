import { supabase } from "@/integrations/supabase/client";

type AvailabilityRow = { product_id: string; is_available: boolean; archived: boolean };

export type AvailabilityState = {
  /** Produtos marcados como esgotados (aparecem no site com a etiqueta). */
  soldOut: Set<string>;
  /** Produtos arquivados (somem do site e ficam na aba Arquivados do painel). */
  archived: Set<string>;
};

/** Devolve null se a consulta falhar: quem chama mantém o estado que já tinha (não "zera" esgotados/arquivados). */
export async function getAvailabilityState(): Promise<AvailabilityState | null> {
  const { data, error } = (await supabase
    .from("product_availability" as never)
    .select("product_id,is_available,archived")) as unknown as {
    data: AvailabilityRow[] | null;
    error: unknown;
  };
  if (error || !data) return null;
  const rows = data;
  return {
    soldOut: new Set(rows.filter((r) => !r.is_available).map((r) => r.product_id)),
    archived: new Set(rows.filter((r) => r.archived).map((r) => r.product_id)),
  };
}

export async function setProductAvailability(productId: string, isAvailable: boolean) {
  return supabase.from("product_availability" as never).upsert(
    { product_id: productId, is_available: isAvailable } as never,
    { onConflict: "product_id" } as never,
  );
}

/** Arquivar tira o produto do site; restaurar traz de volta já disponível. */
export async function setProductArchived(productId: string, archived: boolean) {
  const row = archived
    ? { product_id: productId, archived: true }
    : { product_id: productId, archived: false, is_available: true };
  return supabase
    .from("product_availability" as never)
    .upsert(row as never, { onConflict: "product_id" } as never);
}
