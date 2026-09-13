import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { MessageCircle, Search, Eye, Trash2, X, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_phone: string;
  total: number;
  status: string;
  created_at: string;
  delivery_mode: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_producao: "Em produção",
  aguardando_entrega: "Aguardando entrega",
  na_rua: "Na rua",
  entregue: "Entregue",
};

function waLink(phone: string) {
  return `https://wa.me/55${phone.replace(/\D/g, "")}`;
}

function formatAddress(o: OrderRow) {
  if (o.delivery_mode !== "delivery" || !o.street) return null;
  const parts = [
    `${o.street}${o.number ? `, ${o.number}` : ""}`,
    o.complement || null,
    o.neighborhood || null,
    o.city || null,
  ].filter(Boolean);
  return parts.join(" — ");
}

function CustomerDetailModal({
  customer,
  orders,
  onClose,
  onDeleted,
}: {
  customer: Customer;
  orders: OrderRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const custOrders = orders
    .filter((o) => o.customer_phone === customer.phone)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastAddress = custOrders.map(formatAddress).find((a) => a);
  const totalSpent = custOrders.reduce((s, o) => s + Number(o.total), 0);

  const deleteCustomer = async () => {
    if (
      !confirm(
        `Remover ${customer.name} da lista de clientes? Os pedidos dele continuam salvos no histórico.`,
      )
    )
      return;
    const { error } = await supabase.from("customers" as never).delete().eq("id", customer.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente removido");
      onDeleted();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-3 text-primary-foreground">
          <div>
            <p className="font-display text-xl">{customer.name}</p>
            <p className="text-xs opacity-90">{customer.phone}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Endereço</p>
            <p className="mt-1 flex items-start gap-1.5 text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {lastAddress ?? "Nenhum endereço de entrega registrado ainda (só retirada, ou sem pedidos)."}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <p>
              <span className="text-muted-foreground">Pedidos:</span>{" "}
              <strong>{custOrders.length}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Total gasto:</span>{" "}
              <strong>{brl(totalSpent)}</strong>
            </p>
          </section>

          <section>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Histórico de pedidos
            </p>
            {custOrders.length === 0 ? (
              <p className="text-muted-foreground">Nenhum pedido ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {custOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-foreground">
                        #{o.order_number} ·{" "}
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABEL[o.status] ?? o.status}
                      </p>
                    </div>
                    <span className="font-medium">{brl(Number(o.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button
            onClick={deleteCustomer}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Remover cliente
          </button>
          <a
            href={waLink(customer.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 hover:bg-green-100"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  const load = async () => {
    const [cRes, oRes] = await Promise.all([
      (supabase
        .from("customers" as never)
        .select("*")
        .order("created_at", { ascending: false })) as unknown as Promise<{
        data: Customer[] | null;
      }>,
      (supabase
        .from("orders" as never)
        .select(
          "id,order_number,customer_phone,total,status,created_at,delivery_mode,street,number,complement,neighborhood,city",
        )) as unknown as Promise<{ data: OrderRow[] | null }>,
    ]);
    setCustomers(cRes.data ?? []);
    setOrders(oRes.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    const now = Date.now();
    return customers.map((c) => {
      const ords = orders.filter((o) => o.customer_phone === c.phone);
      const totalSpent = ords.reduce((s, o) => s + Number(o.total), 0);
      const lastOrder = ords.length
        ? new Date(ords.map((o) => o.created_at).sort().at(-1) as string)
        : null;
      const daysSince = lastOrder ? Math.floor((now - lastOrder.getTime()) / 86400000) : null;
      const status: "vip" | "frequente" | "ativo" | "inativo" | "novo" =
        ords.length === 0
          ? "novo"
          : ords.length >= 5
            ? "vip"
            : ords.length >= 3
              ? "frequente"
              : daysSince !== null && daysSince > 60
                ? "inativo"
                : "ativo";
      return { ...c, ordersCount: ords.length, totalSpent, lastOrder, status };
    });
  }, [customers, orders]);

  const filtered = enriched.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const statusCls: Record<string, string> = {
    vip: "bg-purple-100 text-purple-800",
    frequente: "bg-green-100 text-green-800",
    ativo: "bg-blue-100 text-blue-800",
    inativo: "bg-amber-100 text-amber-800",
    novo: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Quem já comprou na TonTon. Status calculado automaticamente.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Pedidos</th>
                <th className="px-4 py-2">Total gasto</th>
                <th className="px-4 py-2">Último</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </td>
                  <td className="px-4 py-2">{c.ordersCount}</td>
                  <td className="px-4 py-2">{brl(c.totalSpent)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {c.lastOrder ? c.lastOrder.toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelected(c)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Eye className="h-3 w-3" /> Abrir
                      </button>
                      <a
                        href={waLink(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CustomerDetailModal
          customer={selected}
          orders={orders}
          onClose={() => setSelected(null)}
          onDeleted={load}
        />
      )}
    </div>
  );
}
