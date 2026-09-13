import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUnifiedProductList } from "@/lib/menu-overrides";
import { brl } from "@/lib/format";
import { Plus, Trash2, Save, Calculator, Scale, X } from "lucide-react";
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
};
type ExtraCostRow = { product_id: string; extra_cost: number };
type Recipe = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
};
type WeighRow = {
  key: string;
  name: string;
  unit: string;
  packPrice: string;
  packSize: string;
  qty: string;
};

function emptyWeighRow(): WeighRow {
  return { key: Math.random().toString(36).slice(2), name: "", unit: "g", packPrice: "", packSize: "", qty: "" };
}

function weighRowCost(r: WeighRow) {
  const price = Number(r.packPrice) || 0;
  const size = Number(r.packSize) || 0;
  const qty = Number(r.qty) || 0;
  return size > 0 ? (price / size) * qty : 0;
}

function CalculadoraPage() {
  const [tab, setTab] = useState<"ingredientes" | "receitas">("ingredientes");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [extraCosts, setExtraCosts] = useState<Map<string, number>>(new Map());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [newIng, setNewIng] = useState({ name: "", unit: "g", package_size: 0, package_price: 0 });
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [showWeigh, setShowWeigh] = useState(false);
  const [weighRows, setWeighRows] = useState<WeighRow[]>([]);
  const [weighYield, setWeighYield] = useState("");
  const [weighExtra, setWeighExtra] = useState("");
  const [savingWeigh, setSavingWeigh] = useState(false);

  const load = async () => {
    const [ingsRes, prodsList, extraCostsRes, recRes] = await Promise.all([
      (supabase
        .from("ingredients" as never)
        .select("*")
        .order("name")) as unknown as Promise<{ data: Ingredient[] | null }>,
      getUnifiedProductList(),
      (supabase
        .from("product_extra_costs" as never)
        .select("*")) as unknown as Promise<{ data: ExtraCostRow[] | null }>,
      (supabase
        .from("product_recipes" as never)
        .select("*")) as unknown as Promise<{ data: Recipe[] | null }>,
    ]);
    setIngredients(ingsRes.data ?? []);
    setProducts([...prodsList].sort((a, b) => a.name.localeCompare(b.name)));
    setExtraCosts(new Map((extraCostsRes.data ?? []).map((r) => [r.product_id, Number(r.extra_cost)])));
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
    let total = extraCosts.get(product.id) ?? 0;
    productRecipes.forEach((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (!ing) return;
      const unitCost = ing.package_price / ing.package_size;
      total += unitCost * r.quantity_per_unit;
    });
    return total;
  }, [productRecipes, ingredients, product, extraCosts]);

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
      .from("product_extra_costs" as never)
      .upsert({ product_id: product.id, extra_cost: value } as never, {
        onConflict: "product_id",
      } as never));
    if (error) toast.error(error.message);
    else load();
  };

  const openWeigh = () => {
    setWeighRows([emptyWeighRow()]);
    setWeighYield("");
    setWeighExtra("");
    setShowWeigh(true);
  };

  const updateWeighRow = (key: string, patch: Partial<WeighRow>) => {
    setWeighRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addWeighRow = () => setWeighRows((rows) => [...rows, emptyWeighRow()]);
  const removeWeighRow = (key: string) => setWeighRows((rows) => rows.filter((r) => r.key !== key));

  const weighTotal = weighRows.reduce((s, r) => s + weighRowCost(r), 0);
  const weighYieldNum = Number(weighYield) || 0;
  const weighExtraNum = Number(weighExtra) || 0;
  const weighPerUnit = weighYieldNum > 0 ? weighTotal / weighYieldNum + weighExtraNum : 0;

  const applyWeighToRecipe = async () => {
    if (!product) return;
    const validRows = weighRows.filter(
      (r) => r.name.trim() && (Number(r.packSize) || 0) > 0 && (Number(r.qty) || 0) > 0,
    );
    if (weighYieldNum <= 0 || validRows.length === 0) {
      toast.error("Preencha o rendimento e pelo menos um ingrediente pesado");
      return;
    }
    setSavingWeigh(true);
    let pantry = ingredients;
    for (const r of validRows) {
      const nameNorm = r.name.trim().toLowerCase();
      let ing = pantry.find((i) => i.name.trim().toLowerCase() === nameNorm && i.unit === r.unit);
      if (!ing) {
        const { data, error } = await supabase
          .from("ingredients" as never)
          .insert({
            name: r.name.trim(),
            unit: r.unit,
            package_size: Number(r.packSize),
            package_price: Number(r.packPrice) || 0,
          } as never)
          .select()
          .single();
        if (error || !data) {
          toast.error(error?.message ?? "Erro ao criar ingrediente");
          continue;
        }
        ing = data as unknown as Ingredient;
        pantry = [...pantry, ing];
      }
      const quantityPerUnit = (Number(r.qty) || 0) / weighYieldNum;
      const { error: recError } = await supabase.from("product_recipes" as never).insert({
        product_id: product.id,
        ingredient_id: ing.id,
        quantity_per_unit: quantityPerUnit,
      } as never);
      if (recError) toast.error(recError.message);
    }
    if (weighExtraNum > 0) {
      await supabase
        .from("product_extra_costs" as never)
        .upsert({ product_id: product.id, extra_cost: weighExtraNum } as never, {
          onConflict: "product_id",
        } as never);
    }
    setSavingWeigh(false);
    toast.success("Receita criada a partir da pesagem!");
    setShowWeigh(false);
    load();
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg">Receita</h3>
                <button
                  onClick={openWeigh}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Scale className="h-3.5 w-3.5" /> Passo a passo: pesar e calcular
                </button>
              </div>
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
                    key={product.id}
                    type="number"
                    step="0.01"
                    defaultValue={extraCosts.get(product.id) ?? 0}
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

      {showWeigh && product && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setShowWeigh(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-3 text-primary-foreground">
              <div>
                <p className="font-display text-lg">Pesar e calcular</p>
                <p className="text-xs opacity-90">{product.name}</p>
              </div>
              <button onClick={() => setShowWeigh(false)} className="rounded-full p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <strong className="font-display text-base text-primary">1</strong>
                  <p className="mt-1 text-muted-foreground">
                    Pese cada ingrediente na balança enquanto faz a receita.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <strong className="font-display text-base text-primary">2</strong>
                  <p className="mt-1 text-muted-foreground">
                    Anote quantas unidades a receita rendeu no final.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <strong className="font-display text-base text-primary">3</strong>
                  <p className="mt-1 text-muted-foreground">
                    Confira o custo e clique em usar — a receita é criada sozinha.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left text-muted-foreground">
                      <th className="px-2 py-2">Ingrediente</th>
                      <th className="px-2 py-2">Un.</th>
                      <th className="px-2 py-2 text-right">Preço do pacote</th>
                      <th className="px-2 py-2 text-right">Tamanho do pacote</th>
                      <th className="px-2 py-2 text-right">Usado na receita</th>
                      <th className="px-2 py-2 text-right">Custo aqui</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {weighRows.map((r) => (
                      <tr key={r.key} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <input
                            value={r.name}
                            onChange={(e) => updateWeighRow(r.key, { name: e.target.value })}
                            placeholder="ex: leite condensado"
                            className="w-full rounded-md border border-border bg-background px-2 py-1"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={r.unit}
                            onChange={(e) => updateWeighRow(r.key, { unit: e.target.value })}
                            className="rounded-md border border-border bg-background px-1.5 py-1"
                          >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="un">un</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={r.packPrice}
                            onChange={(e) => updateWeighRow(r.key, { packPrice: e.target.value })}
                            placeholder="6,50"
                            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={r.packSize}
                            onChange={(e) => updateWeighRow(r.key, { packSize: e.target.value })}
                            placeholder="395"
                            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={r.qty}
                            onChange={(e) => updateWeighRow(r.key, { qty: e.target.value })}
                            placeholder="60"
                            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">{brl(weighRowCost(r))}</td>
                        <td className="px-1 py-1.5">
                          <button
                            onClick={() => removeWeighRow(r.key)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addWeighRow}
                className="w-full rounded-md border border-dashed border-border py-2 text-xs text-primary hover:bg-primary/5"
              >
                + Adicionar ingrediente
              </button>

              <div className="flex justify-end text-sm">
                <span className="text-muted-foreground">Custo total dos ingredientes:&nbsp;</span>
                <strong>{brl(weighTotal)}</strong>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Rendimento (quantas unidades saíram)
                  <input
                    type="number"
                    step="1"
                    value={weighYield}
                    onChange={(e) => setWeighYield(e.target.value)}
                    placeholder="ex: 20"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Custo extra por unidade (embalagem, mão-de-obra)
                  <input
                    type="number"
                    step="0.01"
                    value={weighExtra}
                    onChange={(e) => setWeighExtra(e.target.value)}
                    placeholder="ex: 0,35"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Custo por unidade (com essa pesagem)</p>
                <p className="font-display text-2xl text-primary">{brl(weighPerUnit)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() => setShowWeigh(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={applyWeighToRecipe}
                disabled={savingWeigh}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Usar esta receita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
