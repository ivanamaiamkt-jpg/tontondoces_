import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES } from "@/lib/menu-data";
import { brl } from "@/lib/format";
import {
  DEFAULT_SUGGESTION_POOL,
  isOneTapProduct,
  pickSuggestions,
  type SuggestionMode,
} from "@/lib/cart-suggestions";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  type?: "select";
  textarea?: boolean;
  options?: { value: string; label: string }[];
};

// Campos numéricos: salvos só se forem número válido (aceita vírgula).
const NUMERIC_ERRORS: Record<string, string> = {
  min_order: "Digite um valor válido, por exemplo 15 ou 15,50",
  delivery_max_km: "Digite o raio em km, por exemplo 7",
  delivery_fee_per_km: "Digite a taxa por km, por exemplo 1,10",
  delivery_eta_min: "Digite os minutos, por exemplo 60",
};

const FIELDS: Field[] = [
  { key: "whatsapp", label: "WhatsApp da loja", placeholder: "5511999999999", help: "Só números, com código do país (55) e DDD." },
  { key: "motoboy_whatsapp", label: "WhatsApp do motoboy", placeholder: "5515998244807", help: "Só números, com código do país (55) e DDD. É pra esse número que o painel manda o endereço da entrega." },
  { key: "min_order", label: "Pedido mínimo (R$)", placeholder: "15", help: "Valor mínimo de um pedido, em reais. Ex.: 15 ou 15,50. Vale no site pra todos os clientes assim que você salvar." },
  {
    key: "delivery_enabled",
    label: "Entrega própria",
    type: "select",
    options: [
      { value: "true", label: "Ativa" },
      { value: "false", label: "Desativada (só retirada e Uber)" },
    ],
    help: "Desativada, o cliente só vê retirar na loja e Uber.",
  },
  { key: "delivery_max_km", label: "Raio da entrega (km de carro)", placeholder: "7", help: "Distância máxima, de carro, da loja até o cliente. Acima disso o site avisa que está fora da área." },
  { key: "delivery_fee_per_km", label: "Taxa por km (R$)", placeholder: "1,10", help: "Cobrada por km de carro, sempre arredondando pra cima. Ex.: 3,2 km = 4 km × 1,10 = R$ 4,40." },
  { key: "delivery_eta_min", label: "Tempo médio de entrega (minutos)", placeholder: "60", help: "Aparece pro cliente: \"em média X minutos\"." },
  { key: "pix_key", label: "Chave PIX", placeholder: "email@dominio.com" },
  {
    key: "store_open",
    label: "Loja aberta?",
    type: "select",
    options: [
      { value: "true", label: "Aberta" },
      { value: "false", label: "Fechada" },
    ],
  },
  { key: "closed_message", label: "Mensagem quando fechada", placeholder: "Estamos fechados...", textarea: true },
];

function ConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = (await supabase
        .from("store_settings" as never)
        .select("key,value")) as unknown as { data: { key: string; value: string }[] | null };
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => (map[r.key] = r.value ?? ""));
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const save = async (key: string) => {
    let value = values[key] ?? "";
    if (NUMERIC_ERRORS[key]) {
      const n = Number(value.replace(",", "."));
      // Pedido mínimo pode ser 0; raio, taxa e tempo precisam ser maiores que 0.
      const minOk = key === "min_order" ? n >= 0 : n > 0;
      if (!value.trim() || !Number.isFinite(n) || !minOk) {
        toast.error(NUMERIC_ERRORS[key]);
        return;
      }
      value = String(n);
      setValues((v) => ({ ...v, [key]: value }));
    }
    const { error } = await (supabase
      .from("store_settings" as never)
      .upsert({ key, value, updated_at: new Date().toISOString() } as never));
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Configurações da loja</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp, PIX, pedido mínimo, entrega, status aberto/fechado e mensagens.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium">{f.label}</label>
            {f.type === "select" ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.textarea ? (
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={3}
                placeholder={f.placeholder}
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            ) : (
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            )}
            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
            <button
              onClick={() => save(f.key)}
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              <Save className="h-3 w-3" /> Salvar
            </button>
          </div>
        ))}
      </div>

      <CartSuggestionsSettings />
    </div>
  );
}

/** Sugestões do carrinho: quais produtos entram no rodízio e se rodam por dia ou ficam fixos. */
function CartSuggestionsSettings() {
  const [pool, setPool] = useState<string[]>(DEFAULT_SUGGESTION_POOL);
  const [mode, setMode] = useState<SuggestionMode>("rodizio");

  useEffect(() => {
    (async () => {
      const { data } = (await supabase
        .from("store_settings" as never)
        .select("key,value")
        .in("key", ["cart_suggestions", "cart_suggestions_mode"])) as unknown as {
        data: { key: string; value: string }[] | null;
      };
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      try {
        const parsed = JSON.parse(map.get("cart_suggestions") ?? "null");
        if (Array.isArray(parsed)) setPool(parsed.filter((x) => typeof x === "string"));
      } catch {
        // mantém o padrão
      }
      if (map.get("cart_suggestions_mode") === "fixo") setMode("fixo");
    })();
  }, []);

  const toggle = (id: string) =>
    setPool((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    const now = new Date().toISOString();
    const { error } = await (supabase.from("store_settings" as never).upsert([
      { key: "cart_suggestions", value: JSON.stringify(pool), updated_at: now },
      { key: "cart_suggestions_mode", value: mode, updated_at: now },
    ] as never));
    if (error) toast.error(error.message);
    else toast.success("Sugestões salvas");
  };

  const today = pickSuggestions({ pool, mode, cartProductIds: [], unavailable: new Set() });

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Sugestões no carrinho</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando o cliente abre o carrinho, aparecem 3 produtos pra ele acrescentar com um toque.
        Marque os que podem ser sugeridos (só entram os que não pedem escolha de sabor). Os que já
        estão no carrinho, esgotados ou arquivados não aparecem.
      </p>

      <label className="mt-4 block text-sm font-medium">Como mostrar</label>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as SuggestionMode)}
        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="rodizio">Rodízio: muda todo dia entre os marcados</option>
        <option value="fixo">Fixo: sempre os 3 primeiros marcados</option>
      </select>

      <div className="mt-4 space-y-4">
        {CATEGORIES.map((cat) => {
          const items = cat.products.filter(isOneTapProduct);
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.title}
              </p>
              <ul className="mt-1 space-y-1">
                {items.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={pool.includes(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground">{brl(p.price)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {today.length > 0
          ? `Hoje o carrinho mostra: ${today.map((p) => p.name).join(" · ")}`
          : "Marque pelo menos um produto pra aparecer a sugestão no carrinho."}
      </p>

      <button
        onClick={save}
        className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        <Save className="h-3 w-3" /> Salvar sugestões
      </button>
    </section>
  );
}
