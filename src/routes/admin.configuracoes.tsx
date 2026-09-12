import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

const FIELDS = [
  { key: "whatsapp", label: "WhatsApp da loja", placeholder: "5511999999999", help: "Só números, com código do país (55) e DDD." },
  { key: "motoboy_whatsapp", label: "WhatsApp do motoboy", placeholder: "5515998244807", help: "Só números, com código do país (55) e DDD. Hoje é o Alvaro." },
  { key: "pix_key", label: "Chave PIX", placeholder: "email@dominio.com" },
  { key: "store_open", label: "Loja aberta?", type: "select", options: ["true", "false"] },
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
    const { error } = await (supabase
      .from("store_settings" as never)
      .upsert({ key, value: values[key], updated_at: new Date().toISOString() } as never));
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Configurações da loja</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp, PIX, status aberto/fechado e mensagens.
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
                <option value="true">Aberta</option>
                <option value="false">Fechada</option>
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
    </div>
  );
}
