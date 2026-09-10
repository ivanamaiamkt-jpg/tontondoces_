import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { ShoppingBag, Users, DollarSign, TrendingUp, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

type Stats = {
  ordersToday: number;
  ordersWeek: number;
  revenueToday: number;
  revenueMonth: number;
  customers: number;
  abandoned: number;
  pending: number;
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      const startWeek = new Date(now);
      startWeek.setDate(now.getDate() - 7);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [ordersTodayRes, ordersWeekRes, revenueMonthRes, customersRes, abandonedRes, pendingRes] =
        await Promise.all([
          (supabase
            .from("orders" as never)
            .select("total", { count: "exact" })
            .gte("created_at", startToday.toISOString())) as unknown as Promise<{
            data: { total: number }[] | null;
            count: number | null;
          }>,
          (supabase
            .from("orders" as never)
            .select("id", { count: "exact", head: true })
            .gte("created_at", startWeek.toISOString())) as unknown as Promise<{
            count: number | null;
          }>,
          (supabase
            .from("orders" as never)
            .select("total")
            .gte("created_at", startMonth.toISOString())) as unknown as Promise<{
            data: { total: number }[] | null;
          }>,
          (supabase
            .from("customers" as never)
            .select("id", { count: "exact", head: true })) as unknown as Promise<{
            count: number | null;
          }>,
          (supabase
            .from("carrinhos_abandonados" as never)
            .select("id", { count: "exact", head: true })
            .eq("status", "ativo")) as unknown as Promise<{ count: number | null }>,
          (supabase
            .from("orders" as never)
            .select("id", { count: "exact", head: true })
            .in("status", ["novo", "em_producao", "pronto"])) as unknown as Promise<{
            count: number | null;
          }>,
        ]);

      const revenueToday =
        ordersTodayRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
      const revenueMonth =
        revenueMonthRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;

      setStats({
        ordersToday: ordersTodayRes.count ?? 0,
        ordersWeek: ordersWeekRes.count ?? 0,
        revenueToday,
        revenueMonth,
        customers: customersRes.count ?? 0,
        abandoned: abandonedRes.count ?? 0,
        pending: pendingRes.count ?? 0,
      });
    })();
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          O que tá rolando na loja agora.
        </p>
      </header>

      {!stats ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Pedidos hoje"
              value={stats.ordersToday}
              hint={`${stats.ordersWeek} nos últimos 7 dias`}
              icon={ShoppingBag}
            />
            <StatCard
              title="Faturamento hoje"
              value={brl(stats.revenueToday)}
              hint={`${brl(stats.revenueMonth)} no mês`}
              icon={DollarSign}
            />
            <StatCard
              title="Pedidos abertos"
              value={stats.pending}
              hint="Novos / em produção / prontos"
              icon={TrendingUp}
            />
            <StatCard
              title="Clientes"
              value={stats.customers}
              hint={`${stats.abandoned} carrinhos abandonados`}
              icon={Users}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg">Atalhos do dia</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Veja a aba <strong className="text-foreground">Pedidos</strong> pra
                  mover status (novo → produção → pronto → entregue).
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Confira <strong className="text-foreground">Abandonados</strong> e
                  mande WhatsApp pra recuperar.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg">Dica TonTon 💜</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Edite preços e ative/desative produtos em{" "}
                <strong className="text-foreground">Cardápio</strong>. Ajuste taxas
                de entrega por bairro em{" "}
                <strong className="text-foreground">Taxas</strong>. Cadastre
                ingredientes na <strong className="text-foreground">Calculadora</strong>{" "}
                pra ver sua margem real.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
