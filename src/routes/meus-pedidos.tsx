import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrder } from "@/contexts/order-context";
import { brl, maskPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/tonton/site-header";
import { Heart, MapPin, Package, Plus, Trash2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus Pedidos — TonTon Doces" },
      {
        name: "description",
        content:
          "Acompanhe o status dos seus pedidos e gerencie seus endereços salvos na TonTon Doces.",
      },
    ],
  }),
  component: MeusPedidosPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_fee: number;
  delivery_mode: string;
  payment_method: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    flavorLabels: string[];
  }>;
  created_at: string;
};

type AddressRow = {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string | null;
  is_default: boolean;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-blue-100 text-blue-800" },
  em_producao: { label: "Em produção", cls: "bg-amber-100 text-amber-800" },
  pronto: { label: "Pronto", cls: "bg-green-100 text-green-800" },
  aguardando_entrega: { label: "Aguardando entrega", cls: "bg-amber-100 text-amber-800" },
  na_rua: { label: "Saiu pra entrega", cls: "bg-cyan-100 text-cyan-800" },
  entregue: { label: "Entregue", cls: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-800" },
};

function MeusPedidosPage() {
  const { customer, confirmCustomer } = useOrder();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!customer) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const cleanPhone = customer.phone.replace(/\D/g, "");
      const [ordersRes, addrRes] = await Promise.all([
        (supabase
          .from("orders" as never)
          .select("*")
          .eq("customer_phone", cleanPhone)
          .order("created_at", { ascending: false })
          .limit(50)) as unknown as Promise<{ data: OrderRow[] | null }>,
        customer.id
          ? ((supabase
              .from("customer_addresses" as never)
              .select("*")
              .eq("customer_id", customer.id)
              .order("created_at", { ascending: false })) as unknown as Promise<{
              data: AddressRow[] | null;
            }>)
          : Promise.resolve({ data: [] as AddressRow[] }),
      ]);
      if (!alive) return;
      setOrders(ordersRes.data ?? []);
      setAddresses(addrRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [customer]);

  const handleLogin = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 2 || cleanPhone.length < 10) {
      toast.error("Preenche nome e telefone 💕");
      return;
    }
    await confirmCustomer({ name: name.trim(), phone: cleanPhone });
    toast.success(`Oi, ${name.trim().split(" ")[0]}! 💜`);
  };

  const removeAddress = async (id: string) => {
    await (supabase.from("customer_addresses" as never).delete().eq("id", id));
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    toast.success("Endereço removido");
  };

  if (!customer) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-10">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <Heart className="h-8 w-8 fill-primary text-primary" />
            <h1 className="mt-3 font-display text-2xl text-foreground">
              Sua conta TonTon
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Identifique-se com nome e WhatsApp pra ver seus pedidos e endereços
              salvos. Da próxima vez não pedimos de novo.
            </p>
            <div className="mt-5 space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  placeholder="Como prefere ser chamada"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  className="mt-1"
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                />
              </div>
              <Button
                onClick={handleLogin}
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
              >
                Entrar
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar pro cardápio
        </Link>

        <header className="mb-6">
          <h1 className="font-display text-3xl text-foreground">
            Oi, {customer.name.split(" ")[0]} 💜
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui ficam seus pedidos e endereços.
          </p>
        </header>

        {/* Endereços salvos */}
        <section className="mb-8 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg">Endereços salvos</h2>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum endereço ainda. Os endereços do checkout ficam salvos aqui
              automaticamente.
            </p>
          ) : (
            <ul className="space-y-2">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {a.street}, {a.number}
                      {a.complement ? ` — ${a.complement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.neighborhood}
                      {a.city ? ` — ${a.city}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeAddress(a.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover endereço"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pedidos */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg">Meus pedidos</h2>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}

          {!loading && orders.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Você ainda não fez nenhum pedido por aqui.
              </p>
              <Link
                to="/"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Ver cardápio
              </Link>
            </div>
          )}

          <ul className="space-y-3">
            {orders.map((o) => {
              const status =
                STATUS_LABELS[o.status] ?? {
                  label: o.status,
                  cls: "bg-muted text-muted-foreground",
                };
              const date = new Date(o.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={o.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-base">
                        Pedido #{o.order_number}
                      </p>
                      <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm text-foreground">
                    {(o.items ?? []).map((it, i) => (
                      <li key={i}>
                        {it.quantity}x {it.productName}
                        {it.flavorLabels?.length
                          ? ` — ${it.flavorLabels.join(", ")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {o.delivery_mode === "delivery" ? "Entrega" : "Retirada"} ·{" "}
                      {o.payment_method === "pix" ? "PIX" : "Maquininha"}
                    </span>
                    <span className="font-display text-base font-semibold text-primary">
                      {brl(Number(o.total))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
