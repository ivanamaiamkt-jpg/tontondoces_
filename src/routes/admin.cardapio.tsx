import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/menu-data";
import { getSoldOutProductIds, setProductAvailability } from "@/lib/product-availability";
import {
  getProductOverrides,
  getCustomCategories,
  getCustomProducts,
  upsertProductOverride,
  upsertCustomCategory,
  deleteCustomCategory,
  upsertCustomProduct,
  deleteCustomProduct,
  uploadProductImage,
  type ProductOverrideRow,
  type CustomCategoryRow,
  type CustomProductRow,
} from "@/lib/menu-overrides";
import { brl } from "@/lib/format";
import { Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cardapio")({
  component: CardapioAdminPage,
});

type ProductDraft = { name: string; description: string; price: string; image_url: string };

const emptyDraft: ProductDraft = { name: "", description: "", price: "", image_url: "" };

function CardapioAdminPage() {
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, ProductOverrideRow>>(new Map());
  const [customCategories, setCustomCategories] = useState<CustomCategoryRow[]>([]);
  const [customProducts, setCustomProducts] = useState<CustomProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [uploading, setUploading] = useState(false);

  const [newProductFor, setNewProductFor] = useState<{ kind: "static" | "custom"; id: string } | null>(null);
  const [newProductDraft, setNewProductDraft] = useState<ProductDraft>(emptyDraft);

  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState({ title: "", description: "" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTarget = useRef<"edit" | "new" | null>(null);

  const load = async () => {
    setLoading(true);
    const [soldOutRes, overridesRes, customCatsRes, customProdsRes] = await Promise.all([
      getSoldOutProductIds(),
      getProductOverrides(),
      getCustomCategories(),
      getCustomProducts(),
    ]);
    setSoldOut(soldOutRes);
    setOverrides(overridesRes);
    setCustomCategories(customCatsRes);
    setCustomProducts(customProdsRes);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEsgotado = async (productId: string, currentlySoldOut: boolean) => {
    setPending(productId);
    const { error } = await setProductAvailability(productId, currentlySoldOut);
    setPending(null);
    if (error) toast.error(error.message);
    else {
      toast.success(currentlySoldOut ? "Marcado como disponível" : "Marcado como esgotado");
      load();
    }
  };

  const startEdit = (productId: string, base: { name: string; description: string; price: number; image?: string }) => {
    const ov = overrides.get(productId);
    setEditingId(productId);
    setDraft({
      name: ov?.name ?? base.name,
      description: ov?.description ?? base.description,
      price: String(ov?.price ?? base.price),
      image_url: ov?.image_url ?? base.image ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const priceNum = Number(draft.price.replace(",", "."));
    if (!draft.name.trim() || !priceNum || priceNum <= 0) {
      toast.error("Preencha nome e preço válido");
      return;
    }
    const { error } = await upsertProductOverride(editingId, {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: priceNum,
      image_url: draft.image_url || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Produto atualizado");
      setEditingId(null);
      load();
    }
  };

  const resetOverride = async (productId: string) => {
    const { error } = await upsertProductOverride(productId, {
      name: null,
      description: null,
      price: null,
      image_url: null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Restaurado pro padrão do código");
      setEditingId(null);
      load();
    }
  };

  const saveEditCustom = async (p: CustomProductRow) => {
    const priceNum = Number(draft.price.replace(",", "."));
    if (!draft.name.trim() || !priceNum || priceNum <= 0) {
      toast.error("Preencha nome e preço válido");
      return;
    }
    const { error } = await upsertCustomProduct({
      id: p.id,
      static_category_id: p.static_category_id,
      custom_category_id: p.custom_category_id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: priceNum,
      image_url: draft.image_url || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Produto atualizado");
      setEditingId(null);
      load();
    }
  };

  const removeCustomProduct = async (id: string) => {
    if (!confirm("Excluir esse produto do cardápio?")) return;
    const { error } = await deleteCustomProduct(id);
    if (error) toast.error(error.message);
    else {
      toast.success("Produto removido");
      load();
    }
  };

  const openNewProduct = (kind: "static" | "custom", id: string) => {
    setNewProductFor({ kind, id });
    setNewProductDraft(emptyDraft);
  };

  const saveNewProduct = async () => {
    if (!newProductFor) return;
    const priceNum = Number(newProductDraft.price.replace(",", "."));
    if (!newProductDraft.name.trim() || !priceNum || priceNum <= 0) {
      toast.error("Preencha nome e preço válido");
      return;
    }
    const { error } = await upsertCustomProduct({
      static_category_id: newProductFor.kind === "static" ? newProductFor.id : null,
      custom_category_id: newProductFor.kind === "custom" ? newProductFor.id : null,
      name: newProductDraft.name.trim(),
      description: newProductDraft.description.trim(),
      price: priceNum,
      image_url: newProductDraft.image_url || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Produto adicionado");
      setNewProductFor(null);
      load();
    }
  };

  const saveNewCategory = async () => {
    if (!newCategoryDraft.title.trim()) {
      toast.error("Dá um nome pra categoria");
      return;
    }
    const { error } = await upsertCustomCategory({
      title: newCategoryDraft.title.trim(),
      description: newCategoryDraft.description.trim(),
      is_active: true,
      sort_order: customCategories.length,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Categoria criada");
      setNewCategoryOpen(false);
      setNewCategoryDraft({ title: "", description: "" });
      load();
    }
  };

  const removeCustomCategory = async (id: string) => {
    if (!confirm("Excluir essa categoria e os produtos dentro dela?")) return;
    const { error } = await deleteCustomCategory(id);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoria removida");
      load();
    }
  };

  const handleFilePicked = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      if (pendingUploadTarget.current === "edit") {
        setDraft((d) => ({ ...d, image_url: url }));
      } else if (pendingUploadTarget.current === "new") {
        setNewProductDraft((d) => ({ ...d, image_url: url }));
      }
      toast.success("Foto enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const triggerUpload = (target: "edit" | "new") => {
    pendingUploadTarget.current = target;
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFilePicked(file);
          e.target.value = "";
        }}
      />

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Cardápio</h1>
          <p className="text-sm text-muted-foreground">
            Edite nome, preço, descrição e foto de qualquer produto, cadastre produtos e
            categorias novos, e marque itens como esgotado.
          </p>
        </div>
        <button
          onClick={() => setNewCategoryOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-glow"
        >
          <Plus className="h-4 w-4" /> Nova categoria
        </button>
      </header>

      {newCategoryOpen && (
        <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="mb-3 font-display text-lg">Nova categoria</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              placeholder="Nome da categoria"
              value={newCategoryDraft.title}
              onChange={(e) => setNewCategoryDraft((d) => ({ ...d, title: e.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição curta (opcional)"
              value={newCategoryDraft.description}
              onChange={(e) => setNewCategoryDraft((d) => ({ ...d, description: e.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveNewCategory}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Criar categoria
            </button>
            <button
              onClick={() => setNewCategoryOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {CATEGORIES.map((cat) => {
            const extraProducts = customProducts.filter((p) => p.static_category_id === cat.id);
            return (
              <section key={cat.id} className="mb-6 rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 font-display text-xl">{cat.title}</h2>
                <ul className="divide-y divide-border">
                  {cat.products.map((p) => {
                    const isSoldOut = soldOut.has(p.id);
                    const ov = overrides.get(p.id);
                    const isEditing = editingId === p.id;
                    return (
                      <li key={p.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className={`min-w-0 flex-1 ${isSoldOut ? "opacity-50" : ""}`}>
                            <p className="truncate font-medium text-foreground">
                              {ov?.name ?? p.name}
                              {isSoldOut && (
                                <span className="ml-2 text-xs font-semibold uppercase text-destructive">
                                  Esgotado
                                </span>
                              )}
                              {ov && (
                                <span className="ml-2 text-xs font-semibold uppercase text-primary">
                                  Editado
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ov?.description ?? p.description}
                            </p>
                          </div>
                          <p className="shrink-0 font-display text-base text-primary">
                            {brl(ov?.price ?? p.price)}
                          </p>
                          <button
                            onClick={() =>
                              isEditing ? setEditingId(null) : startEdit(p.id, p)
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" /> {isEditing ? "Fechar" : "Editar"}
                          </button>
                          <button
                            onClick={() => toggleEsgotado(p.id, isSoldOut)}
                            disabled={pending === p.id}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
                          >
                            {isSoldOut ? (
                              <>
                                <Eye className="h-4 w-4" /> Disponível
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4" /> Esgotado
                              </>
                            )}
                          </button>
                        </div>

                        {isEditing && (
                          <div className="mt-3 space-y-2 rounded-xl bg-muted/30 p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                placeholder="Nome"
                                value={draft.name}
                                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                              />
                              <input
                                placeholder="Preço"
                                inputMode="decimal"
                                value={draft.price}
                                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                              />
                            </div>
                            <textarea
                              placeholder="Descrição"
                              value={draft.description}
                              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                              rows={2}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              {draft.image_url && (
                                <img
                                  src={draft.image_url}
                                  alt=""
                                  className="h-14 w-14 rounded-lg object-cover"
                                />
                              )}
                              <button
                                onClick={() => triggerUpload("edit")}
                                disabled={uploading}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {uploading ? "Enviando..." : "Trocar foto"}
                              </button>
                              <button
                                onClick={saveEdit}
                                className="ml-auto rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                              >
                                Salvar
                              </button>
                              {ov && (
                                <button
                                  onClick={() => resetOverride(p.id)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Usar padrão
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}

                  {extraProducts.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <li key={p.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">
                              {p.name}
                              <span className="ml-2 text-xs font-semibold uppercase text-gold">
                                Novo
                              </span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                          </div>
                          <p className="shrink-0 font-display text-base text-primary">{brl(Number(p.price))}</p>
                          <button
                            onClick={() =>
                              isEditing
                                ? setEditingId(null)
                                : (setEditingId(p.id),
                                  setDraft({
                                    name: p.name,
                                    description: p.description,
                                    price: String(p.price),
                                    image_url: p.image_url ?? "",
                                  }))
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" /> {isEditing ? "Fechar" : "Editar"}
                          </button>
                          <button
                            onClick={() => removeCustomProduct(p.id)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {isEditing && (
                          <div className="mt-3 space-y-2 rounded-xl bg-muted/30 p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                placeholder="Nome"
                                value={draft.name}
                                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                              />
                              <input
                                placeholder="Preço"
                                inputMode="decimal"
                                value={draft.price}
                                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                              />
                            </div>
                            <textarea
                              placeholder="Descrição"
                              value={draft.description}
                              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                              rows={2}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              {draft.image_url && (
                                <img src={draft.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                              )}
                              <button
                                onClick={() => triggerUpload("edit")}
                                disabled={uploading}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {uploading ? "Enviando..." : "Trocar foto"}
                              </button>
                              <button
                                onClick={() => saveEditCustom(p)}
                                className="ml-auto rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {newProductFor?.kind === "static" && newProductFor.id === cat.id ? (
                  <NewProductForm
                    draft={newProductDraft}
                    setDraft={setNewProductDraft}
                    uploading={uploading}
                    onUpload={() => triggerUpload("new")}
                    onSave={saveNewProduct}
                    onCancel={() => setNewProductFor(null)}
                  />
                ) : (
                  <button
                    onClick={() => openNewProduct("static", cat.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" /> Novo produto em {cat.title}
                  </button>
                )}
              </section>
            );
          })}

          {customCategories.map((cc) => {
            const products = customProducts.filter((p) => p.custom_category_id === cc.id);
            return (
              <section key={cc.id} className="mb-6 rounded-2xl border border-gold/40 bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-xl">
                    {cc.title} <span className="text-xs font-semibold uppercase text-gold">Nova</span>
                  </h2>
                  <button
                    onClick={() => removeCustomCategory(cc.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir categoria
                  </button>
                </div>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {products.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <li key={p.id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{p.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                            </div>
                            <p className="shrink-0 font-display text-base text-primary">{brl(Number(p.price))}</p>
                            <button
                              onClick={() =>
                                isEditing
                                  ? setEditingId(null)
                                  : (setEditingId(p.id),
                                    setDraft({
                                      name: p.name,
                                      description: p.description,
                                      price: String(p.price),
                                      image_url: p.image_url ?? "",
                                    }))
                              }
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                            >
                              <Pencil className="h-4 w-4" /> {isEditing ? "Fechar" : "Editar"}
                            </button>
                            <button
                              onClick={() => removeCustomProduct(p.id)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {isEditing && (
                            <div className="mt-3 space-y-2 rounded-xl bg-muted/30 p-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  placeholder="Nome"
                                  value={draft.name}
                                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                                />
                                <input
                                  placeholder="Preço"
                                  inputMode="decimal"
                                  value={draft.price}
                                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                                />
                              </div>
                              <textarea
                                placeholder="Descrição"
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                rows={2}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                {draft.image_url && (
                                  <img src={draft.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                                )}
                                <button
                                  onClick={() => triggerUpload("edit")}
                                  disabled={uploading}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  {uploading ? "Enviando..." : "Trocar foto"}
                                </button>
                                <button
                                  onClick={() => saveEditCustom(p)}
                                  className="ml-auto rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {newProductFor?.kind === "custom" && newProductFor.id === cc.id ? (
                  <NewProductForm
                    draft={newProductDraft}
                    setDraft={setNewProductDraft}
                    uploading={uploading}
                    onUpload={() => triggerUpload("new")}
                    onSave={saveNewProduct}
                    onCancel={() => setNewProductFor(null)}
                  />
                ) : (
                  <button
                    onClick={() => openNewProduct("custom", cc.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" /> Novo produto em {cc.title}
                  </button>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function NewProductForm({
  draft,
  setDraft,
  uploading,
  onUpload,
  onSave,
  onCancel,
}: {
  draft: ProductDraft;
  setDraft: (fn: (d: ProductDraft) => ProductDraft) => void;
  uploading: boolean;
  onUpload: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-primary">Novo produto</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Nome"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Preço"
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <textarea
        placeholder="Descrição"
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        {draft.image_url && <img src={draft.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
        <button
          onClick={onUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Adicionar foto"}
        </button>
        <button
          onClick={onSave}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Adicionar produto
        </button>
      </div>
    </div>
  );
}
