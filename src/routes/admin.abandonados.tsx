import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { MessageCircle, CheckCircle, Bell, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/abandonados")({
  component: AbandonadosPage,
});

type Status = "ativo" | "notificado" | "convertido" | "fora_area";

type Cart = {
  id: string;
  nome: string;
  telefone: string | null;
  itens: Array<{ nome?: string; productName?: string; quantidade?: number; quantity?: number; preco_unitario?: number; preco_total?: number }>;
  total: number;
  status: Status;
  atualizado_em: string;
  criado_em: string;
};

const STATUS_LABEL: Record<Status, string> = {
  ativo: "Ativo",
  notificado: "Notificado",
  convertido: "Convertido",
  fora_area: "Fora da área",
};

const STATUS_STYLE: Record<Status, string> = {
  ativo: "bg-amber-100 text-amber-800 border-amber-200",
  notificado: "bg-blue-100 text-blue-800 border-blue-200",
  convertido: "bg-green-100 text-green-800 border-green-200",
  fora_area: "bg-muted text-muted-foreground border-border",
};

function AbandonadosPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status>("ativo");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("carrinhos_abandonados")
      .select("*")
      .eq("status", filter)
      .order("atualizado_em", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setCarts((data as Cart[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("carrinhos_abandonados")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marcado como ${STATUS_LABEL[status].toLowerCase()}`);
      load();
    }
  };

  const deleteCart = async (id: string) => {
    if (!window.confirm("Excluir este carrinho? Não dá pra desfazer.")) return;
    const { error } = await supabase.from("carrinhos_abandonados").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Carrinho excluído");
      load();
    }
  };

  const waLink = (c: Cart) => {
    const items = (c.itens ?? [])
      .map((it) => `${it.quantidade ?? it.quantity ?? 1}x ${it.nome ?? it.productName ?? "Item"}`)
      .join(", ");
    const firstName = c.nome?.split(" ")[0] ?? "";
    const msg = encodeURIComponent(
      `Oi${firstName ? ", " + firstName : ""}! 💜 Vi que você tava montando um pedido na TonTon (${items}). Posso te ajudar a finalizar?`,
    );
    return `https://wa.me/55${(c.telefone ?? "").replace(/\D/g, "")}?text=${msg}`;
  };

  const tabs: Status[] = ["ativo", "notificado", "convertido", "fora_area"];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Carrinhos abandonados</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe e mude o status manualmente conforme o atendimento.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              filter === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : carts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum carrinho {STATUS_LABEL[filter].toLowerCase()}.
        </div>
      ) : (
        <ul className="space-y-3">
          {carts.map((c) => {
            const updated = new Date(c.atualizado_em).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {c.nome}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {c.telefone ?? "sem telefone"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">Última atividade: {updated}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLE[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    <p className="font-display text-lg text-primary">{brl(Number(c.total))}</p>
                  </div>
                </div>
                <ul className="mt-2 text-sm text-foreground">
                  {(c.itens ?? []).slice(0, 5).map((it, i) => (
                    <li key={i}>
                      {it.quantidade ?? it.quantity ?? 1}× {it.nome ?? it.productName ?? "Item"}
                    </li>
                  ))}
                  {(c.itens ?? []).length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      ...e mais {(c.itens ?? []).length - 5}
                    </li>
                  )}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.telefone && (
                    <a
                      href={waLink(c)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-800 hover:bg-green-100"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                  {c.status !== "ativo" && (
                    <button
                      onClick={() => setStatus(c.id, "ativo")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <RotateCcw className="h-4 w-4" /> Ativo
                    </button>
                  )}
                  {c.status !== "notificado" && (
                    <button
                      onClick={() => setStatus(c.id, "notificado")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-100"
                    >
                      <Bell className="h-4 w-4" /> Notificado
                    </button>
                  )}
                  {c.status !== "convertido" && (
                    <button
                      onClick={() => setStatus(c.id, "convertido")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-800 hover:bg-green-100"
                    >
                      <CheckCircle className="h-4 w-4" /> Convertido
                    </button>
                  )}
                  <button
                    onClick={() => deleteCart(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
