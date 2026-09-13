import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { ShoppingBag, Users, DollarSign, TrendingUp } from "lucide-react";

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

type ChecklistItem = { key: string; label: string; linkTo?: string };
type ChecklistBlock = { title: string; emoji: string; items: ChecklistItem[] };

const DAILY_BLOCKS: ChecklistBlock[] = [
  {
    title: "Manhã",
    emoji: "🌅",
    items: [
      { key: "ver-pedidos-novos", label: "Ver pedidos novos", linkTo: "/admin/pedidos" },
      { key: "checar-compras", label: "Checar o que falta comprar pra produção de hoje" },
      { key: "planejar-producao", label: "Planejar quanto vai produzir hoje" },
    ],
  },
  {
    title: "Durante o dia",
    emoji: "🍰",
    items: [
      { key: "produzir-pedidos", label: "Produzir os pedidos" },
      {
        key: "atualizar-esgotados",
        label: "Atualizar itens esgotados no cardápio, se precisar",
        linkTo: "/admin/cardapio",
      },
      { key: "responder-clientes", label: "Responder clientes (WhatsApp/Instagram)" },
      {
        key: "despachar-pedidos",
        label: "Despachar pedidos prontos pro motoboy",
        linkTo: "/admin/pedidos",
      },
    ],
  },
  {
    title: "Fechamento do dia",
    emoji: "🌙",
    items: [
      { key: "lancar-vendas", label: "Lançar vendas do dia", linkTo: "/admin/financeiro" },
      {
        key: "pedir-avaliacao",
        label: "Pedir avaliação de quem recebeu hoje",
        linkTo: "/admin/pedidos",
      },
      { key: "post-story", label: "Fazer 1 post ou story" },
    ],
  },
];

const WEEKLY_ITEMS: ChecklistItem[] = [
  {
    key: "revisar-cardapio",
    label: "Revisar cardápio (preços, fotos, itens parados)",
    linkTo: "/admin/cardapio",
  },
  { key: "planejar-compras-semana", label: "Planejar compras da semana" },
  {
    key: "olhar-financeiro-semana",
    label: "Dar uma olhada em Financeiro/Visitas da semana",
    linkTo: "/admin/financeiro",
  },
];

function todayKey() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function mondayKey() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

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

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <label className="flex flex-1 cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
        />
        <span className={checked ? "text-muted-foreground line-through" : "text-foreground"}>
          {item.label}
        </span>
      </label>
      {item.linkTo && (
        <Link
          to={item.linkTo as "/admin/pedidos"}
          className="shrink-0 whitespace-nowrap text-xs text-primary hover:underline"
        >
          abrir →
        </Link>
      )}
    </li>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());

  const dayKey = useMemo(() => todayKey(), []);
  const weekKey = useMemo(() => mondayKey(), []);

  const loadChecklist = async () => {
    const { data } = (await supabase
      .from("checklist_state" as never)
      .select("period_key, item_key")
      .in("period_key", [dayKey, weekKey])) as unknown as {
      data: { period_key: string; item_key: string }[] | null;
    };
    setCheckedKeys(new Set((data ?? []).map((r) => `${r.period_key}:${r.item_key}`)));
  };

  useEffect(() => {
    loadChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isChecked = (periodKey: string, itemKey: string) => checkedKeys.has(`${periodKey}:${itemKey}`);

  const toggleItem = async (periodKey: string, itemKey: string) => {
    const id = `${periodKey}:${itemKey}`;
    const currentlyChecked = checkedKeys.has(id);
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (currentlyChecked) next.delete(id);
      else next.add(id);
      return next;
    });
    if (currentlyChecked) {
      await supabase
        .from("checklist_state" as never)
        .delete()
        .eq("period_key", periodKey)
        .eq("item_key", itemKey);
    } else {
      await supabase
        .from("checklist_state" as never)
        .upsert({ period_key: periodKey, item_key: itemKey } as never);
    }
  };

  const dailyTotal = DAILY_BLOCKS.reduce((s, b) => s + b.items.length, 0);
  const dailyDone = DAILY_BLOCKS.reduce(
    (s, b) => s + b.items.filter((it) => isChecked(dayKey, it.key)).length,
    0,
  );
  const weeklyDone = WEEKLY_ITEMS.filter((it) => isChecked(weekKey, it.key)).length;

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
            .in("status", ["novo", "em_producao", "aguardando_entrega", "na_rua"])) as unknown as Promise<{
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
      <header className="mb-4">
        <h1 className="font-display text-3xl text-foreground">Visão geral</h1>
      </header>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="font-display text-lg italic text-primary">
          Prosperidade vem de organização.
        </p>
        <p className="text-sm text-muted-foreground">
          Organize seu negócio e veja os milagres acontecerem.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">Rotina de hoje</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {dailyDone} de {dailyTotal} feitas
            </span>
          </div>
          <ProgressBar done={dailyDone} total={dailyTotal} />

          <div className="mt-4 space-y-4">
            {DAILY_BLOCKS.map((block) => (
              <div key={block.title}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {block.emoji} {block.title}
                </p>
                <ul className="mt-1 divide-y divide-border">
                  {block.items.map((item) => (
                    <ChecklistRow
                      key={item.key}
                      item={item}
                      checked={isChecked(dayKey, item.key)}
                      onToggle={() => toggleItem(dayKey, item.key)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">Rotina semanal</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {weeklyDone} de {WEEKLY_ITEMS.length} feitas
            </span>
          </div>
          <ProgressBar done={weeklyDone} total={WEEKLY_ITEMS.length} />
          <p className="mt-2 text-xs text-muted-foreground">
            Não precisa fazer tudo num dia só — marque conforme for dando conta. Reseta toda
            segunda-feira.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {WEEKLY_ITEMS.map((item) => (
              <ChecklistRow
                key={item.key}
                item={item}
                checked={isChecked(weekKey, item.key)}
                onToggle={() => toggleItem(weekKey, item.key)}
              />
            ))}
          </ul>
        </section>
      </div>

      {!stats ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            hint="Novos / em produção / aguardando entrega / na rua"
            icon={TrendingUp}
          />
          <StatCard
            title="Clientes"
            value={stats.customers}
            hint={`${stats.abandoned} carrinhos abandonados`}
            icon={Users}
          />
        </div>
      )}
    </div>
  );
}
