import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { MessageCircle, Search } from "lucide-react";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};
type OrderSum = { customer_phone: string; total: number; created_at: string };

function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderSum[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [cRes, oRes] = await Promise.all([
        (supabase
          .from("customers" as never)
          .select("*")
          .order("created_at", { ascending: false })) as unknown as Promise<{
          data: Customer[] | null;
        }>,
        (supabase
          .from("orders" as never)
          .select("customer_phone,total,created_at")) as unknown as Promise<{
          data: OrderSum[] | null;
        }>,
      ]);
      setCustomers(cRes.data ?? []);
      setOrders(oRes.data ?? []);
    })();
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
                    {c.lastOrder
                      ? c.lastOrder.toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
