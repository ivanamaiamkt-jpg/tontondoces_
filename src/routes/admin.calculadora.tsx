import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Plus, Trash2, Save, Calculator } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/calculadora")({
  component: CalculadoraPage,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  package_size: number;
  package_price: number;
};
type Product = {
  id: string;
  name: string;
  price: number;
  extra_cost: number | null;
};
type Recipe = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
};

function CalculadoraPage() {
  const [tab, setTab] = useState<"ingredientes" | "receitas">("ingredientes");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [newIng, setNewIng] = useState({ name: "", unit: "g", package_size: 0, package_price: 0 });
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const load = async () => {
    const [ingsRes, prodsRes, recRes] = await Promise.all([
      (supabase
        .from("ingredients" as never)
        .select("*")
        .order("name")) as unknown as Promise<{ data: Ingredient[] | null }>,
      (supabase
        .from("menu_products" as never)
        .select("id,name,price,extra_cost")
        .order("name")) as unknown as Promise<{ data: Product[] | null }>,
      (supabase
        .from("product_recipes" as never)
        .select("*")) as unknown as Promise<{ data: Recipe[] | null }>,
    ]);
    setIngredients(ingsRes.data ?? []);
    setProducts(prodsRes.data ?? []);
    setRecipes(recRes.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const addIngredient = async () => {
    if (!newIng.name || newIng.package_size <= 0 || newIng.package_price <= 0) {
      toast.error("Preencha nome, tamanho e preço da embalagem");
      return;
    }
    const { error } = await (supabase
      .from("ingredients" as never)
      .insert(newIng as never));
    if (error) toast.error(error.message);
    else {
      toast.success("Ingrediente cadastrado");
      setNewIng({ name: "", unit: "g", package_size: 0, package_price: 0 });
      load();
    }
  };

  const removeIngredient = async (id: string) => {
    if (!confirm("Excluir esse ingrediente? As receitas que usam ele não serão afetadas, mas vão dar erro.")) return;
    const { error } = await (supabase.from("ingredients" as never).delete().eq("id", id));
    if (error) toast.error(error.message);
    else load();
  };

  const product = products.find((p) => p.id === selectedProduct);
  const productRecipes = recipes.filter((r) => r.product_id === selectedProduct);

  const cost = useMemo(() => {
    if (!product) return 0;
    let total = Number(product.extra_cost ?? 0);
    productRecipes.forEach((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (!ing) return;
      const unitCost = ing.package_price / ing.package_size;
      total += unitCost * r.quantity_per_unit;
    });
    return total;
  }, [productRecipes, ingredients, product]);

  const margin = product ? Number(product.price) - cost : 0;
  const marginPct = product && Number(product.price) > 0 ? (margin / Number(product.price)) * 100 : 0;

  const addRecipeLine = async () => {
    if (!selectedProduct || ingredients.length === 0) return;
    const { error } = await (supabase
      .from("product_recipes" as never)
      .insert({
        product_id: selectedProduct,
        ingredient_id: ingredients[0].id,
        quantity_per_unit: 0,
      } as never));
    if (error) toast.error(error.message);
    else load();
  };

  const updateRecipe = async (id: string, patch: Partial<Recipe>) => {
    const { error } = await (supabase
      .from("product_recipes" as never)
      .update(patch as never)
      .eq("id", id));
    if (error) toast.error(error.message);
    else load();
  };

  const removeRecipe = async (id: string) => {
    const { error } = await (supabase.from("product_recipes" as never).delete().eq("id", id));
    if (error) toast.error(error.message);
    else load();
  };

  const updateExtraCost = async (value: number) => {
    if (!product) return;
    const { error } = await (supabase
      .from("menu_products" as never)
      .update({ extra_cost: value } as never)
      .eq("id", product.id));
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Calculadora de custo</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre seus ingredientes (com preço e quanto rende a embalagem). Depois monte a receita
          de cada produto e veja sua margem real.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("ingredientes")}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            tab === "ingredientes"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card"
          }`}
        >
          Ingredientes
        </button>
        <button
          onClick={() => setTab("receitas")}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            tab === "receitas"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card"
          }`}
        >
          Receitas & margem
        </button>
      </div>

      {tab === "ingredientes" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-lg">Novo ingrediente</h2>
          <div className="grid gap-2 sm:grid-cols-5">
            <input
              placeholder="Nome (ex: Leite condensado)"
              value={newIng.name}
              onChange={(e) => setNewIng({ ...newIng, name: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={newIng.unit}
              onChange={(e) => setNewIng({ ...newIng, unit: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="g">gramas (g)</option>
              <option value="ml">mililitros (ml)</option>
              <option value="un">unidade (un)</option>
            </select>
            <input
              type="number"
              placeholder="Tamanho da embalagem"
              value={newIng.package_size || ""}
              onChange={(e) => setNewIng({ ...newIng, package_size: Number(e.target.value) })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Preço pago (R$)"
              value={newIng.package_price || ""}
              onChange={(e) => setNewIng({ ...newIng, package_price: Number(e.target.value) })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addIngredient}
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>

          <h2 className="mt-6 mb-2 font-display text-lg">Cadastrados</h2>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ingrediente ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ingredients.map((i) => {
                const unitCost = i.package_price / i.package_size;
                return (
                  <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.package_size}
                        {i.unit} = {brl(Number(i.package_price))} ·{" "}
                        {brl(unitCost)}/{i.unit}
                      </p>
                    </div>
                    <button
                      onClick={() => removeIngredient(i.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "receitas" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <label className="text-sm">
            Escolha um produto
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="ml-2 mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— selecione —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {product && (
            <div className="mt-5">
              <h3 className="mb-2 font-display text-lg">Receita</h3>
              {ingredients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cadastre ingredientes na aba anterior primeiro.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {productRecipes.map((r) => {
                      const ing = ingredients.find((i) => i.id === r.ingredient_id);
                      return (
                        <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <select
                            value={r.ingredient_id}
                            onChange={(e) =>
                              updateRecipe(r.id, { ingredient_id: e.target.value })
                            }
                            className="rounded-md border border-border bg-background px-2 py-1"
                          >
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.001"
                            value={r.quantity_per_unit}
                            onChange={(e) =>
                              updateRecipe(r.id, { quantity_per_unit: Number(e.target.value) })
                            }
                            className="w-24 rounded-md border border-border bg-background px-2 py-1"
                          />
                          <span className="text-muted-foreground">{ing?.unit}/un</span>
                          <button
                            onClick={() => removeRecipe(r.id)}
                            className="ml-auto rounded-md p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    onClick={addRecipeLine}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" /> Adicionar ingrediente
                  </button>
                </>
              )}

              <div className="mt-4">
                <label className="text-sm">
                  Custo extra (mão-de-obra, embalagem) por unidade R$
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={Number(product.extra_cost ?? 0)}
                    onBlur={(e) => updateExtraCost(Number(e.target.value))}
                    className="ml-2 w-24 rounded-md border border-border bg-background px-2 py-1"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="font-display text-2xl">{brl(cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Preço de venda</p>
                  <p className="font-display text-2xl">{brl(Number(product.price))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p
                    className={`font-display text-2xl ${
                      margin > 0 ? "text-green-700" : "text-destructive"
                    }`}
                  >
                    {brl(margin)}{" "}
                    <span className="text-base">({marginPct.toFixed(0)}%)</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {!product && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4" /> Selecione um produto pra montar a receita.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
