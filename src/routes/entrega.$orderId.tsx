import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { CheckCircle2, Copy, Loader2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entrega/$orderId")({
  head: () => ({
    meta: [
      { title: "Entrega — TonTon Doces" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EntregaPage,
});

type OrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_mode: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  payment_method: string;
  total: number;
  items: OrderItem[];
};

function EntregaPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = (await supabase
      .from("orders" as never)
      .select("*")
      .eq("id", orderId)
      .maybeSingle()) as unknown as { data: OrderRow | null };
    setOrder(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 text-center">
        <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>
      </div>
    );
  }

  const enderecoLine =
    order.delivery_mode === "delivery"
      ? `${order.street ?? ""}, ${order.number ?? ""}${order.complement ? ` — ${order.complement}` : ""} — ${order.neighborhood ?? ""} — ${order.city ?? ""}`
      : "Retirada no local";

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 px-4 py-8 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl">
        <div className="rounded-t-3xl bg-primary px-6 py-5 text-primary-foreground">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
            TonTon Doces
          </p>
          <h1 className="mt-1 font-display text-2xl">Pedido #{order.order_number}</h1>
        </div>

        <div className="space-y-4 p-6 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
            <p className="mt-1 flex items-center gap-1.5 text-foreground">
              {order.customer_name}
            </p>
            <a
              href={`tel:${order.customer_phone}`}
              className="mt-0.5 inline-flex items-center gap-1.5 text-primary"
            >
              <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
            </a>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Endereço</p>
            <div className="mt-1 flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="flex-1 text-foreground">{enderecoLine}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(enderecoLine);
                  toast.success("Endereço copiado!");
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-glow"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Itens</p>
            <ul className="mt-1 space-y-1 text-foreground">
              {(order.items ?? []).map((it, i) => (
                <li key={i}>
                  {it.quantity}× {it.productName}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="text-muted-foreground">
              {order.payment_method === "pix" ? "PIX (já pago)" : "Maquininha na entrega"}
            </span>
            <span className="font-display text-lg text-primary">{brl(Number(order.total))}</span>
          </section>

          {order.status === "entregue" ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="font-display text-lg text-emerald-700">Pedido já entregue!</p>
              <p className="text-xs text-emerald-700/80">Obrigada 💜</p>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              Esses são os dados do pedido pra conferência. Qualquer dúvida, fala com a TonTon
              pelo WhatsApp.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
