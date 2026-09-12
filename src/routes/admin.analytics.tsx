import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, ShoppingCart, Package } from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

const NO_SOURCE_LABEL = "Direto / sem origem";
/** Origens que a loja já pretende usar (bio, live, stories, Google) — aparecem
 * sempre na lista/gráfico, mesmo com 0 registros, pra ela ver o que falta rastrear. */
const TRACKED_SOURCES = ["bio", "live", "stories", "google"];

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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
  const [reportFrom, setReportFrom] = useState(todayISO());
  const [reportTo, setReportTo] = useState(todayISO());
  const [visits, setVisits] = useState<{ utm_source: string | null }[]>([]);
  const [carts, setCarts] = useState<{ utm_source: string | null }[]>([]);
  const [orders, setOrders] = useState<{ utm_source: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    const fromTs = `${reportFrom}T00:00:00`;
    const toTs = `${reportTo}T23:59:59.999`;
    const [visitsRes, cartsRes, ordersRes] = await Promise.all([
      (supabase
        .from("site_visits" as never)
        .select("utm_source")
        .gte("created_at", fromTs)
        .lte("created_at", toTs)) as unknown as Promise<{
        data: { utm_source: string | null }[] | null;
      }>,
      (supabase
        .from("carrinhos_abandonados" as never)
        .select("utm_source")
        .gte("criado_em", fromTs)
        .lte("criado_em", toTs)) as unknown as Promise<{
        data: { utm_source: string | null }[] | null;
      }>,
      (supabase
        .from("orders" as never)
        .select("utm_source")
        .gte("created_at", fromTs)
        .lte("created_at", toTs)) as unknown as Promise<{
        data: { utm_source: string | null }[] | null;
      }>,
    ]);
    setVisits(visitsRes.data ?? []);
    setCarts(cartsRes.data ?? []);
    setOrders(ordersRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bySource = useMemo(() => {
    const sources = new Set<string>(TRACKED_SOURCES);
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

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <label className="text-xs">
          <span className="block text-muted-foreground">De</span>
          <input
            type="date"
            value={reportFrom}
            onChange={(e) => setReportFrom(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground">Até</span>
          <input
            type="date"
            value={reportTo}
            onChange={(e) => setReportTo(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={loadReport}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Aplicar
        </button>
        <p className="ml-2 text-xs text-muted-foreground">
          Mostrando {formatDate(reportFrom)} a {formatDate(reportTo)}. O rastreio de visitas
          começou em 12/09/2026 — pedidos e carrinhos de antes dessa data não têm visita
          correspondente, por isso o período padrão é só a partir de hoje.
        </p>
      </div>

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
          </section>
        </>
      )}
    </div>
  );
}
