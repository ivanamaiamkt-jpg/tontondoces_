import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Pencil, Eye, EyeOff, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cardapio")({
  component: CardapioAdminPage,
});

type Category = { id: string; title: string; sort_order: number; is_active: boolean };
type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  badge: string | null;
  is_active: boolean;
  is_suggestion: boolean;
  requires_scheduling: boolean;
  sort_order: number;
};

function CardapioAdminPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Product>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [catsRes, prodRes] = await Promise.all([
      (supabase
        .from("menu_categories" as never)
        .select("*")
        .order("sort_order")) as unknown as Promise<{ data: Category[] | null }>,
      (supabase
        .from("menu_products" as never)
        .select("*")
        .order("sort_order")) as unknown as Promise<{ data: Product[] | null }>,
    ]);
    setCats(catsRes.data ?? []);
    setProducts(prodRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (p: Product) => {
    setEditing(p.id);
    setDraft({ name: p.name, description: p.description, price: p.price, badge: p.badge });
  };

  const saveEdit = async (id: string) => {
    const { error } = await (supabase
      .from("menu_products" as never)
      .update({
        name: draft.name,
        description: draft.description,
        price: draft.price,
        badge: draft.badge || null,
      } as never)
      .eq("id", id));
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Salvo");
      setEditing(null);
      load();
    }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await (supabase
      .from("menu_products" as never)
      .update({ is_active: !p.is_active } as never)
      .eq("id", p.id));
    if (error) toast.error(error.message);
    else load();
  };

  const toggleCategoryActive = async (c: Category) => {
    const { error } = await (supabase
      .from("menu_categories" as never)
      .update({ is_active: !c.is_active } as never)
      .eq("id", c.id));
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Cardápio</h1>
        <p className="text-sm text-muted-foreground">
          Edite preços, ative/desative produtos e categorias. Mudanças aparecem na hora pro cliente.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        cats.map((cat) => {
          const items = products.filter((p) => p.category_id === cat.id);
          return (
            <section
              key={cat.id}
              className="mb-6 rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl">
                  {cat.title}{" "}
                  {!cat.is_active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Oculta
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => toggleCategoryActive(cat)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {cat.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {cat.is_active ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <ul className="divide-y divide-border">
                {items.map((p) => {
                  const isEditing = editing === p.id;
                  return (
                    <li key={p.id} className="py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={draft.name ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                          <textarea
                            value={draft.description ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, description: e.target.value }))
                            }
                            rows={2}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                          <div className="flex flex-wrap gap-2">
                            <label className="text-xs">
                              Preço (R$)
                              <input
                                type="number"
                                step="0.01"
                                value={draft.price ?? 0}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, price: Number(e.target.value) }))
                                }
                                className="ml-2 w-28 rounded-md border border-border bg-background px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="text-xs">
                              Badge
                              <input
                                value={draft.badge ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, badge: e.target.value }))
                                }
                                placeholder="ex: 🔥 Promo"
                                className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
                              />
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                            >
                              <Save className="h-4 w-4" />
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"
                            >
                              <X className="h-4 w-4" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className={`min-w-0 flex-1 ${!p.is_active ? "opacity-50" : ""}`}>
                            <p className="truncate font-medium text-foreground">
                              {p.name}
                              {p.badge && (
                                <span className="ml-2 text-xs text-primary">{p.badge}</span>
                              )}
                              {!p.is_active && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (inativo)
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.description}
                            </p>
                          </div>
                          <p className="font-display text-base text-primary">
                            {brl(Number(p.price))}
                          </p>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => toggleActive(p)}
                              className="rounded-md border border-border p-1.5 hover:bg-muted"
                              aria-label={p.is_active ? "Desativar" : "Ativar"}
                            >
                              {p.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => startEdit(p)}
                              className="rounded-md border border-border p-1.5 hover:bg-muted"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
