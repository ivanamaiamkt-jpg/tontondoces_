import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import {
  ShoppingBag,
  Users,
  DollarSign,
  TrendingUp,
  Pencil,
  Trash2,
  Plus,
  Settings2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

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

type ChecklistItemRow = {
  id: string;
  frequency: "daily" | "weekly";
  block: string;
  label: string;
  link_to: string | null;
  sort_order: number;
};

const DAILY_BLOCK_ORDER = ["Manhã", "Tarde", "Fechamento"];
const BLOCK_EMOJI: Record<string, string> = { Manhã: "🌅", Tarde: "🍰", Fechamento: "🌙" };

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
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ChecklistItemRow[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [newItemDrafts, setNewItemDrafts] = useState<Record<string, string>>({});

  const dayKey = useMemo(() => todayKey(), []);
  const weekKey = useMemo(() => mondayKey(), []);

  const loadItems = async () => {
    const { data } = (await supabase
      .from("checklist_items" as never)
      .select("*")
      .order("sort_order")) as unknown as { data: ChecklistItemRow[] | null };
    setItems(data ?? []);
  };

  const loadState = async () => {
    const { data } = (await supabase
      .from("checklist_state" as never)
      .select("period_key, item_id")
      .in("period_key", [dayKey, weekKey])) as unknown as {
      data: { period_key: string; item_id: string }[] | null;
    };
    setCheckedIds(new Set((data ?? []).map((r) => `${r.period_key}:${r.item_id}`)));
  };

  useEffect(() => {
    loadItems();
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isChecked = (periodKey: string, itemId: string) => checkedIds.has(`${periodKey}:${itemId}`);

  const toggleItem = async (periodKey: string, itemId: string) => {
    const id = `${periodKey}:${itemId}`;
    const currentlyChecked = checkedIds.has(id);
    setCheckedIds((prev) => {
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
        .eq("item_id", itemId);
    } else {
      await supabase.from("checklist_state" as never).upsert({ period_key: periodKey, item_id: itemId } as never);
    }
  };

  const startEdit = (item: ChecklistItemRow) => {
    setEditingId(item.id);
    setEditDraft(item.label);
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft.trim()) return;
    const { error } = await supabase
      .from("checklist_items" as never)
      .update({ label: editDraft.trim() } as never)
      .eq("id", editingId);
    if (error) toast.error(error.message);
    setEditingId(null);
    loadItems();
  };

  const moveItem = async (itemId: string, newBlock: string) => {
    const { error } = await supabase
      .from("checklist_items" as never)
      .update({ block: newBlock } as never)
      .eq("id", itemId);
    if (error) toast.error(error.message);
    else loadItems();
  };

  const removeItem = async (itemId: string) => {
    if (!confirm("Excluir essa tarefa da rotina?")) return;
    const { error } = await supabase.from("checklist_items" as never).delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else loadItems();
  };

  const addItem = async (frequency: "daily" | "weekly", block: string) => {
    const draftKey = `${frequency}:${block}`;
    const label = (newItemDrafts[draftKey] ?? "").trim();
    if (!label) return;
    const sameBlock = items.filter((i) => i.block === block);
    const maxOrder = sameBlock.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error } = await supabase.from("checklist_items" as never).insert({
      frequency,
      block,
      label,
      sort_order: maxOrder + 1,
    } as never);
    if (error) toast.error(error.message);
    else {
      setNewItemDrafts((prev) => ({ ...prev, [draftKey]: "" }));
      loadItems();
    }
  };

  const dailyItems = items.filter((i) => i.frequency === "daily");
  const weeklyItems = items
    .filter((i) => i.frequency === "weekly")
    .sort((a, b) => a.sort_order - b.sort_order);

  const dailyBlocks = DAILY_BLOCK_ORDER.map((block) => ({
    block,
    items: dailyItems.filter((i) => i.block === block).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const dailyTotal = dailyItems.length;
  const dailyDone = dailyItems.filter((i) => isChecked(dayKey, i.id)).length;
  const weeklyDone = weeklyItems.filter((i) => isChecked(weekKey, i.id)).length;

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

      const revenueToday = ordersTodayRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
      const revenueMonth = revenueMonthRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;

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

  function ItemRow({ item, periodKey }: { item: ChecklistItemRow; periodKey: string }) {
    const checked = isChecked(periodKey, item.id);
    if (editingId === item.id) {
      return (
        <li className="flex items-center gap-2 py-1.5">
          <input
            autoFocus
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <button onClick={saveEdit} className="rounded p-1 text-primary hover:bg-primary/10">
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      );
    }
    return (
      <li className="flex items-center justify-between gap-2 py-1.5">
        <label className="flex flex-1 cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleItem(periodKey, item.id)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span className={checked ? "text-muted-foreground line-through" : "text-foreground"}>
            {item.label}
          </span>
        </label>
        {!editMode && item.link_to && (
          <Link
            to={item.link_to as "/admin/pedidos"}
            className="shrink-0 whitespace-nowrap text-xs text-primary hover:underline"
          >
            abrir →
          </Link>
        )}
        {editMode && (
          <div className="flex shrink-0 items-center gap-1">
            {item.frequency === "daily" && (
              <select
                value={item.block}
                onChange={(e) => moveItem(item.id, e.target.value)}
                className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
              >
                {DAILY_BLOCK_ORDER.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => startEdit(item)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeItem(item.id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </li>
    );
  }

  function AddItemRow({ frequency, block }: { frequency: "daily" | "weekly"; block: string }) {
    const draftKey = `${frequency}:${block}`;
    return (
      <li className="flex items-center gap-2 py-1.5">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={newItemDrafts[draftKey] ?? ""}
          onChange={(e) => setNewItemDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addItem(frequency, block)}
          placeholder="nova tarefa..."
          className="flex-1 rounded-md border border-dashed border-border bg-background px-2 py-1 text-sm"
        />
        <button
          onClick={() => addItem(frequency, block)}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Adicionar
        </button>
      </li>
    );
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-display text-3xl text-foreground">Visão geral</h1>
      </header>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="font-display text-lg italic text-primary">Prosperidade vem de organização.</p>
        <p className="text-sm text-muted-foreground">
          Organize seu negócio e veja os milagres acontecerem.
        </p>
      </div>

      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
            editMode
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {editMode ? "Concluir edição" : "Editar rotina"}
        </button>
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
            {dailyBlocks.map(({ block, items: blockItems }) => (
              <div key={block}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {BLOCK_EMOJI[block] ?? ""} {block}
                </p>
                <ul className="mt-1 divide-y divide-border">
                  {blockItems.map((item) => (
                    <ItemRow key={item.id} item={item} periodKey={dayKey} />
                  ))}
                  {editMode && <AddItemRow frequency="daily" block={block} />}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">Rotina semanal</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {weeklyDone} de {weeklyItems.length} feitas
            </span>
          </div>
          <ProgressBar done={weeklyDone} total={weeklyItems.length} />
          <p className="mt-2 text-xs text-muted-foreground">
            Não precisa fazer tudo num dia só — marque conforme for dando conta. Reseta toda
            segunda-feira.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {weeklyItems.map((item) => (
              <ItemRow key={item.id} item={item} periodKey={weekKey} />
            ))}
            {editMode && <AddItemRow frequency="weekly" block="Semanal" />}
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
