import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, ShoppingCart, Package } from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

const NO_SOURCE_LABEL = "Direto / sem origem";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: typeof Eye;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
    </div>
  );
}

function AnalyticsPage() {
  const [visits, setVisits] = useState<{ utm_source: string | null }[]>([]);
  const [carts, setCarts] = useState<{ utm_source: string | null }[]>([]);
  const [orders, setOrders] = useState<{ utm_source: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [visitsRes, cartsRes, ordersRes] = await Promise.all([
        (supabase.from("site_visits" as never).select("utm_source")) as unknown as Promise<{
          data: { utm_source: string | null }[] | null;
        }>,
        (supabase.from("carrinhos_abandonados" as never).select("utm_source")) as unknown as Promise<{
          data: { utm_source: string | null }[] | null;
        }>,
        (supabase.from("orders" as never).select("utm_source")) as unknown as Promise<{
          data: { utm_source: string | null }[] | null;
        }>,
      ]);
      setVisits(visitsRes.data ?? []);
      setCarts(cartsRes.data ?? []);
      setOrders(ordersRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  const bySource = useMemo(() => {
    const sources = new Set<string>();
    [visits, carts, orders].forEach((list) =>
      list.forEach((r) => sources.add(r.utm_source || NO_SOURCE_LABEL)),
    );
    const count = (list: { utm_source: string | null }[], source: string) =>
      list.filter((r) => (r.utm_source || NO_SOURCE_LABEL) === source).length;

    return Array.from(sources)
      .map((source) => ({
        source,
        visitas: count(visits, source),
        carrinhos: count(carts, source),
        pedidos: count(orders, source),
      }))
      .sort((a, b) => b.visitas - a.visitas);
  }, [visits, carts, orders]);

  const totalVisits = visits.length;
  const totalCarts = carts.length;
  const totalOrders = orders.length;
  const cartConversion = totalVisits > 0 ? Math.round((totalCarts / totalVisits) * 100) : 0;
  const orderConversion = totalCarts > 0 ? Math.round((totalOrders / totalCarts) * 100) : 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Visitas e origem</h1>
        <p className="text-sm text-muted-foreground">
          Funil de visitas → carrinhos iniciados → pedidos concluídos, e de onde vem cada um
          (bio, live, stories, Google...).
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Visitas" value={totalVisits} icon={Eye} />
            <StatCard
              title="Carrinhos iniciados"
              value={`${totalCarts} (${cartConversion}%)`}
              icon={ShoppingCart}
            />
            <StatCard
              title="Pedidos concluídos"
              value={`${totalOrders} (${orderConversion}% dos carrinhos)`}
              icon={Package}
            />
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg">Por origem (utm_source)</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Use links com <code className="rounded bg-muted px-1">?utm_source=bio</code>,{" "}
              <code className="rounded bg-muted px-1">?utm_source=live</code>,{" "}
              <code className="rounded bg-muted px-1">?utm_source=stories</code> etc. na bio,
              stories e lives pra aparecer aqui separado.
            </p>

            {bySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma visita registrada ainda.</p>
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySource} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="visitas" name="Visitas" fill="#c9b8d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="carrinhos" name="Carrinhos" fill="#9b6bb0" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pedidos" name="Pedidos" fill="#5c1f5c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ul className="mt-4 divide-y divide-border text-sm">
                  {bySource.map((r) => (
                    <li key={r.source} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-medium">{r.source}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.visitas} visitas · {r.carrinhos} carrinhos · {r.pedidos} pedidos
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
