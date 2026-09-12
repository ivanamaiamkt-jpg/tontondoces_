import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Plus, Trash2, Save, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/taxas")({
  component: TaxasPage,
});

type Fee = {
  id: string;
  neighborhood: string;
  fee: number;
  is_active: boolean;
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function TaxasPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [newFee, setNewFee] = useState({ neighborhood: "", fee: 0 });
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const filteredFees = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return fees;
    return fees.filter((f) => normalize(f.neighborhood).includes(q));
  }, [fees, search]);

  const load = async () => {
    const { data } = (await supabase
      .from("delivery_fees" as never)
      .select("*")
      .order("neighborhood")) as unknown as { data: Fee[] | null };
    setFees(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!newFee.neighborhood.trim() || newFee.fee < 0) {
      toast.error("Informe bairro e taxa");
      return;
    }
    const { error } = await (supabase
      .from("delivery_fees" as never)
      .insert(newFee as never));
    if (error) toast.error(error.message);
    else {
      toast.success("Bairro adicionado");
      setNewFee({ neighborhood: "", fee: 0 });
      load();
    }
  };

  const save = async (f: Fee) => {
    const value = drafts[f.id] ?? f.fee;
    const { error } = await (supabase
      .from("delivery_fees" as never)
      .update({ fee: value } as never)
      .eq("id", f.id));
    if (error) toast.error(error.message);
    else {
      toast.success("Salvo");
      setDrafts((d) => {
        const n = { ...d };
        delete n[f.id];
        return n;
      });
      load();
    }
  };

  const toggle = async (f: Fee) => {
    const { error } = await (supabase
      .from("delivery_fees" as never)
      .update({ is_active: !f.is_active } as never)
      .eq("id", f.id));
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esse bairro?")) return;
    const { error } = await (supabase.from("delivery_fees" as never).delete().eq("id", id));
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Taxas de entrega</h1>
        <p className="text-sm text-muted-foreground">
          Bairros que você atende e o valor da entrega. O cliente vê a taxa exata no checkout.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg">Adicionar bairro</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newFee.neighborhood}
            onChange={(e) => setNewFee({ ...newFee, neighborhood: e.target.value })}
            placeholder="Nome do bairro"
            className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.5"
            value={newFee.fee || ""}
            onChange={(e) => setNewFee({ ...newFee, fee: Number(e.target.value) })}
            placeholder="Taxa (R$)"
            className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bairro..."
            className="w-full bg-transparent text-sm outline-none"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filteredFees.length}/{fees.length}
          </span>
        </div>

        {fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado.</p>
        ) : filteredFees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bairro encontrado pra "{search}".</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredFees.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                <p className={`flex-1 ${!f.is_active ? "text-muted-foreground line-through" : ""}`}>
                  {f.neighborhood}
                </p>
                <div className="flex items-center gap-1 text-sm">
                  R$
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={Number(f.fee)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [f.id]: Number(e.target.value) }))
                    }
                    className="w-20 rounded-md border border-border bg-background px-2 py-1"
                  />
                </div>
                {drafts[f.id] !== undefined && drafts[f.id] !== Number(f.fee) && (
                  <button
                    onClick={() => save(f)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                  >
                    <Save className="h-3 w-3" /> Salvar
                  </button>
                )}
                <button
                  onClick={() => toggle(f)}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  {f.is_active ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => remove(f.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
