import { supabase } from "@/integrations/supabase/client";

type AvailabilityRow = { product_id: string; is_available: boolean };

/** IDs de produtos marcados como esgotados (is_available = false). */
export async function getSoldOutProductIds(): Promise<Set<string>> {
  const { data } = (await supabase
    .from("product_availability" as never)
    .select("product_id")
    .eq("is_available", false)) as unknown as { data: AvailabilityRow[] | null };
  return new Set((data ?? []).map((r) => r.product_id));
}

export async function setProductAvailability(productId: string, isAvailable: boolean) {
  return supabase.from("product_availability" as never).upsert(
    { product_id: productId, is_available: isAvailable } as never,
    { onConflict: "product_id" } as never,
  );
}
