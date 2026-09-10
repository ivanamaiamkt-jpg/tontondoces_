import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { DollarSign, TrendingDown, TrendingUp, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinanceiroPage,
});

type DailySale = {
  sale_date: string;
  cardapio: number;
  ifood: number;
  noventa_e_nove: number;
  notes: string | null;
};

type Expense = {
  id: string;
  expense_date: string;
  description: string;
  category: string | null;
  amount: number;
};

const EXPENSE_CATEGORIES = [
  "Ingredientes",
  "Embalagem",
  "Entrega/Combustível",
  "Equipamento",
  "Marketing",
  "Outros",
];

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
  tone,
}: {
  title: string;
  value: string;
  icon: typeof DollarSign;
  tone: "up" | "down" | "neutral";
}) {
  const toneClass =
    tone === "up" ? "text-emerald-600" : tone === "down" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className={`mt-2 font-display text-3xl ${toneClass}`}>{value}</p>
    </div>
  );
}

function FinanceiroPage() {
  const [monthSales, setMonthSales] = useState<DailySale[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [recentSales, setRecentSales] = useState<DailySale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [saleDate, setSaleDate] = useState(todayISO());
  const [cardapio, setCardapio] = useState("0");
  const [ifood, setIfood] = useState("0");
  const [noventaNove, setNoventaNove] = useState("0");
  const [saleNotes, setSaleNotes] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  const monthStart = useMemo(() => todayISO().slice(0, 7) + "-01", []);

  const loadAll = async () => {
    setLoading(true);
    const [salesRes, expensesRes, recentSalesRes, recentExpensesRes] = await Promise.all([
      (supabase
        .from("daily_sales" as never)
        .select("*")
        .gte("sale_date", monthStart)) as unknown as Promise<{ data: DailySale[] | null }>,
      (supabase
        .from("expenses" as never)
        .select("*")
        .gte("expense_date", monthStart)) as unknown as Promise<{ data: Expense[] | null }>,
      (supabase
        .from("daily_sales" as never)
        .select("*")
        .order("sale_date", { ascending: false })
        .limit(15)) as unknown as Promise<{ data: DailySale[] | null }>,
      (supabase
        .from("expenses" as never)
        .select("*")
        .order("expense_date", { ascending: false })
        .limit(15)) as unknown as Promise<{ data: Expense[] | null }>,
    ]);
    setMonthSales(salesRes.data ?? []);
    setMonthExpenses(expensesRes.data ?? []);
    setRecentSales(recentSalesRes.data ?? []);
    setRecentExpenses(recentExpensesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao trocar a data de venda, sugere o total do cardápio (pedidos reais do site) pra aquele dia.
  useEffect(() => {
    (async () => {
      const existing = recentSales.find((s) => s.sale_date === saleDate);
      if (existing) {
        setCardapio(String(existing.cardapio));
        setIfood(String(existing.ifood));
        setNoventaNove(String(existing.noventa_e_nove));
        setSaleNotes(existing.notes ?? "");
        return;
      }
      const start = `${saleDate}T00:00:00`;
      const end = `${saleDate}T23:59:59`;
      const { data } = (await supabase
        .from("orders" as never)
        .select("total")
        .gte("created_at", start)
        .lte("created_at", end)) as unknown as { data: { total: number }[] | null };
      const total = (data ?? []).reduce((s, o) => s + Number(o.total), 0);
      setCardapio(String(total));
      setIfood("0");
      setNoventaNove("0");
      setSaleNotes("");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleDate]);

  const saveSale = async () => {
    setSavingSale(true);
    const { error } = await supabase.from("daily_sales" as never).upsert(
      {
        sale_date: saleDate,
        cardapio: Number(cardapio) || 0,
        ifood: Number(ifood) || 0,
        noventa_e_nove: Number(noventaNove) || 0,
        notes: saleNotes || null,
      } as never,
      { onConflict: "sale_date" } as never,
    );
    setSavingSale(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Vendas do dia salvas");
      loadAll();
    }
  };

  const addExpense = async () => {
    if (!expenseDesc.trim() || !expenseAmount || Number(expenseAmount) <= 0) {
      toast.error("Preencha descrição e valor da despesa");
      return;
    }
    setSavingExpense(true);
    const { error } = await supabase.from("expenses" as never).insert({
      expense_date: expenseDate,
      description: expenseDesc.trim(),
      category: expenseCategory,
      amount: Number(expenseAmount),
    } as never);
    setSavingExpense(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Despesa registrada");
      setExpenseDesc("");
      setExpenseAmount("");
      loadAll();
    }
  };

  const removeExpense = async (id: string) => {
    if (!confirm("Excluir essa despesa?")) return;
    const { error } = await supabase.from("expenses" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Despesa removida");
      loadAll();
    }
  };

  const monthEntradas = monthSales.reduce(
    (s, r) => s + Number(r.cardapio) + Number(r.ifood) + Number(r.noventa_e_nove),
    0,
  );
  const monthSaidas = monthExpenses.reduce((s, r) => s + Number(r.amount), 0);
  const monthSaldo = monthEntradas - monthSaidas;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Vendas por canal, despesas e saldo do mês.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Entradas no mês" value={brl(monthEntradas)} icon={TrendingUp} tone="up" />
            <StatCard title="Saídas no mês" value={brl(monthSaidas)} icon={TrendingDown} tone="down" />
            <StatCard
              title="Saldo do mês"
              value={brl(monthSaldo)}
              icon={DollarSign}
              tone={monthSaldo >= 0 ? "neutral" : "down"}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Vendas do dia */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg">Vendas do dia</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Cardápio já vem sugerido com os pedidos reais do site pra essa data — ajuste se
                precisar. iFood e 99 são lançados manualmente.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Cardápio</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cardapio}
                      onChange={(e) => setCardapio(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">iFood</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ifood}
                      onChange={(e) => setIfood(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">99</label>
                    <input
                      type="number"
                      step="0.01"
                      value={noventaNove}
                      onChange={(e) => setNoventaNove(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Observações (opcional)
                  </label>
                  <input
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder="ex: evento particular, promoção..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={saveSale}
                  disabled={savingSale}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> Salvar vendas do dia
                </button>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Últimos lançamentos
                </p>
                <ul className="divide-y divide-border text-sm">
                  {recentSales.length === 0 && (
                    <li className="py-2 text-muted-foreground">Nenhum lançamento ainda.</li>
                  )}
                  {recentSales.map((s) => {
                    const total = Number(s.cardapio) + Number(s.ifood) + Number(s.noventa_e_nove);
                    return (
                      <li key={s.sale_date} className="flex items-center justify-between py-2">
                        <button
                          onClick={() => setSaleDate(s.sale_date)}
                          className="text-left hover:text-primary"
                        >
                          <p>{formatDate(s.sale_date)}</p>
                          <p className="text-xs text-muted-foreground">
                            Cardápio {brl(Number(s.cardapio))} · iFood {brl(Number(s.ifood))} · 99{" "}
                            {brl(Number(s.noventa_e_nove))}
                          </p>
                        </button>
                        <span className="font-medium">{brl(total)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* Despesas */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg">Despesas</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Tudo que for comprado ou pago no dia a dia (ingredientes, embalagem, etc).
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <input
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="ex: leite condensado, caixinhas..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={addExpense}
                  disabled={savingExpense}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Adicionar despesa
                </button>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Últimos lançamentos
                </p>
                <ul className="divide-y divide-border text-sm">
                  {recentExpenses.length === 0 && (
                    <li className="py-2 text-muted-foreground">Nenhuma despesa ainda.</li>
                  )}
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p>{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(e.expense_date)} · {e.category ?? "Sem categoria"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-destructive">
                          −{brl(Number(e.amount))}
                        </span>
                        <button
                          onClick={() => removeExpense(e.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
