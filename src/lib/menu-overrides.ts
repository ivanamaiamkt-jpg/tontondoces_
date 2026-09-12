import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category, type Product } from "@/lib/menu-data";

export type ProductOverrideRow = {
  product_id: string;
  name: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
};

export type CustomCategoryRow = {
  id: string;
  title: string;
  description: string;
  badge: string | null;
  sort_order: number;
  is_active: boolean;
};

export type CustomProductRow = {
  id: string;
  static_category_id: string | null;
  custom_category_id: string | null;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  badge: string | null;
  unit_label: string | null;
  is_active: boolean;
  sort_order: number;
};

export async function getProductOverrides(): Promise<Map<string, ProductOverrideRow>> {
  const { data } = (await supabase
    .from("product_overrides" as never)
    .select("*")) as unknown as { data: ProductOverrideRow[] | null };
  const map = new Map<string, ProductOverrideRow>();
  (data ?? []).forEach((r) => map.set(r.product_id, r));
  return map;
}

export async function getCustomCategories(): Promise<CustomCategoryRow[]> {
  const { data } = (await supabase
    .from("custom_categories" as never)
    .select("*")
    .order("sort_order")) as unknown as { data: CustomCategoryRow[] | null };
  return data ?? [];
}

export async function getCustomProducts(): Promise<CustomProductRow[]> {
  const { data } = (await supabase
    .from("custom_products" as never)
    .select("*")
    .order("sort_order")) as unknown as { data: CustomProductRow[] | null };
  return data ?? [];
}

function customProductToProduct(r: CustomProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    originalPrice: r.original_price != null ? Number(r.original_price) : undefined,
    image: r.image_url ?? undefined,
    unitLabel: r.unit_label ?? undefined,
    badge: r.badge ?? undefined,
  };
}

/**
 * Cardápio "mesclado": catálogo estático do código + overrides de
 * produto existente + categorias/produtos 100% novos cadastrados no
 * painel. Devolve o mesmo formato Category[] de sempre — nada que
 * já consome CATEGORIES precisa saber da existência do banco.
 */
export async function getMergedCategories(): Promise<Category[]> {
  const [overrides, customCategories, customProducts] = await Promise.all([
    getProductOverrides(),
    getCustomCategories(),
    getCustomProducts(),
  ]);

  const activeCustomCategories = customCategories.filter((c) => c.is_active);
  const activeCustomProducts = customProducts.filter((p) => p.is_active);

  const merged: Category[] = CATEGORIES.map((cat) => ({
    ...cat,
    products: cat.products.map((p) => {
      const ov = overrides.get(p.id);
      if (!ov) return p;
      return {
        ...p,
        name: ov.name ?? p.name,
        description: ov.description ?? p.description,
        price: ov.price != null ? Number(ov.price) : p.price,
        image: ov.image_url ?? p.image,
      };
    }),
  }));

  activeCustomProducts
    .filter((cp) => cp.static_category_id)
    .forEach((cp) => {
      const cat = merged.find((c) => c.id === cp.static_category_id);
      if (cat) cat.products.push(customProductToProduct(cp));
    });

  activeCustomCategories.forEach((cc) => {
    merged.push({
      id: `custom-cat-${cc.id}`,
      title: cc.title,
      description: cc.description,
      badge: cc.badge ?? undefined,
      products: activeCustomProducts
        .filter((cp) => cp.custom_category_id === cc.id)
        .map(customProductToProduct),
    });
  });

  return merged;
}

/** Lista unificada (estáticos + customizados) pra calculadora de custo escolher produto real. */
export async function getUnifiedProductList(): Promise<{ id: string; name: string; price: number }[]> {
  const categories = await getMergedCategories();
  const list: { id: string; name: string; price: number }[] = [];
  categories.forEach((cat) => cat.products.forEach((p) => list.push({ id: p.id, name: p.name, price: p.price })));
  return list;
}

export async function upsertProductOverride(
  productId: string,
  patch: Partial<Pick<ProductOverrideRow, "name" | "description" | "price" | "image_url">>,
) {
  return supabase
    .from("product_overrides" as never)
    .upsert({ product_id: productId, ...patch } as never, { onConflict: "product_id" } as never);
}

export async function upsertCustomCategory(
  patch: Partial<CustomCategoryRow> & { title: string },
) {
  return supabase.from("custom_categories" as never).upsert(patch as never);
}

export async function deleteCustomCategory(id: string) {
  return supabase.from("custom_categories" as never).delete().eq("id", id);
}

export async function upsertCustomProduct(
  patch: Partial<CustomProductRow> & { name: string; price: number },
) {
  return supabase.from("custom_products" as never).upsert(patch as never);
}

export async function deleteCustomProduct(id: string) {
  return supabase.from("custom_products" as never).delete().eq("id", id);
}

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
