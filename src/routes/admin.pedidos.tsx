import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { OWNER_WHATSAPP } from "@/lib/menu-data";
import { MessageCircle, Phone, Trash2, X, Check, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — TonTon Admin" },
      { name: "theme-color", content: "#5c1f5c" },
    ],
    links: [{ rel: "manifest", href: "/manifest-admin.json" }],
  }),
  component: PedidosPage,
});

const PIX_KEY = "diretorios.tonton@gmail.com";

type OrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  flavorLabels: string[];
  eventLabel?: string;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_mode: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  complement: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  notes_internal: string | null;
  event_date: string | null;
  items: OrderItem[];
  created_at: string;
  pos_venda_feito: boolean;
};

type ColumnDef = {
  id: string;
  title: string;
  emoji: string;
  bg: string;
  headerBg: string;
  headerText: string;
};

const COLUMNS: ColumnDef[] = [
  { id: "novo", title: "Novo", emoji: "🆕", bg: "#fff8e1", headerBg: "#f59e0b", headerText: "#fff" },
  { id: "em_producao", title: "Em produção", emoji: "👩‍🍳", bg: "#e7f1ff", headerBg: "#2563eb", headerText: "#fff" },
  { id: "aguardando_entrega", title: "Aguardando entrega", emoji: "📦", bg: "#fef3c7", headerBg: "#d97706", headerText: "#fff" },
  { id: "na_rua", title: "Na rua", emoji: "🛵", bg: "#ecfeff", headerBg: "#0891b2", headerText: "#fff" },
  { id: "entregue", title: "Entregue", emoji: "✅", bg: "#eef0f2", headerBg: "#6b7280", headerText: "#fff" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string, now: number) {
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `há ${diff}s`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  if (h < 24) return `há ${h}h${rem ? ` ${rem}min` : ""}`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function playBeep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "sine";
      o2.frequency.value = 1175;
      g2.gain.setValueAtTime(0.0001, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start();
      o2.stop(ctx.currentTime + 0.5);
    }, 250);
  } catch {
    // ignore
  }
}

function waLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function buildAcceptMsg(o: Order) {
  const first = o.customer_name.split(" ")[0];
  return `Oi ${first}! 🍫 Seu pedido #${o.order_number} foi aceito e já está sendo preparado com muito carinho! Assim que ficar prontinho eu te aviso. 💕\nTonTon Doces`;
}

function buildReadyMsg(o: Order) {
  const first = o.customer_name.split(" ")[0];
  const pay =
    o.payment_method === "pix"
      ? `\n\nChave PIX: ${PIX_KEY}\nValor: ${brl(Number(o.total))}`
      : `\n\nPagamento na entrega na maquininha 💳`;
  return `Oi ${first}! 🍫 Seu pedido #${o.order_number} está prontinho e já vamos providenciar a entrega!${pay}\n\nQualquer dúvida é só chamar! 💕`;
}

function buildMotoboyMsg(o: Order) {
  const enderecoLine =
    o.delivery_mode === "delivery"
      ? `${o.street ?? ""}, ${o.number ?? ""}${o.complement ? ` — ${o.complement}` : ""} — ${o.neighborhood ?? ""} — ${o.city ?? ""}`
      : "Retirada no local";
  const itensLine = o.items
    .map((it) => `${it.quantity}x ${it.productName}`)
    .join(", ");
  const pagamentoLine =
    o.payment_method === "pix" ? "PIX (já pago)" : "Maquininha (cobrar na entrega)";
  return `🛵 Nova entrega — TonTon Doces\nCliente: ${o.customer_name} — ${o.customer_phone}\nEndereço: ${enderecoLine}\nItens: ${itensLine}\nTotal: ${brl(Number(o.total))} — Pagamento: ${pagamentoLine}`;
}

type CardHandlers = {
  now: number;
  onOpenDetail: (o: Order) => void;
  onAccept: (o: Order) => void;
  onReject: (o: Order) => void;
  onReady: (o: Order) => void;
  onDispatch: (o: Order) => void;
  onDelivered: (o: Order) => void;
  onTogglePosVenda: (o: Order) => void;
  onRemove: (id: string) => void;
};

function OrderCardBody({ order: o, colId, h }: { order: Order; colId: string; h: CardHandlers }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold text-foreground">#{o.order_number}</p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(o.created_at, h.now)}</p>
      </div>
      <p className="mt-0.5 truncate text-sm text-foreground">
        {o.customer_name}{" "}
        <span className="text-xs text-muted-foreground">· {formatTime(o.created_at)}</span>
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {o.delivery_mode === "delivery" ? o.neighborhood ?? "Entrega" : "Retirada"} ·{" "}
        {o.payment_method === "pix" ? "PIX" : "Maquininha"}
      </p>
      <p className="mt-1 font-display text-lg text-primary">{brl(Number(o.total))}</p>

      <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        <a
          href={waLink(o.customer_phone, `Oi ${o.customer_name.split(" ")[0]}! Sobre o pedido #${o.order_number} 💜`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800 hover:bg-green-200"
        >
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </a>

        {colId === "novo" && (
          <>
            <button
              onClick={() => h.onAccept(o)}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-700"
            >
              <Check className="h-3 w-3" /> Aceitar
            </button>
            <button
              onClick={() => h.onReject(o)}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
            >
              <Ban className="h-3 w-3" /> Recusar
            </button>
          </>
        )}
        {colId === "em_producao" && (
          <button
            onClick={() => h.onReady(o)}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <Check className="h-3 w-3" /> Pronto
          </button>
        )}
        {colId === "aguardando_entrega" && (
          <button
            onClick={() => h.onDispatch(o)}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
          >
            <MessageCircle className="h-3 w-3" /> Saiu pra entrega
          </button>
        )}
        {colId === "na_rua" && (
          <button
            onClick={() => h.onDelivered(o)}
            className="inline-flex items-center gap-1 rounded-md bg-gray-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-gray-800"
          >
            <Check className="h-3 w-3" /> Entregue
          </button>
        )}
        {colId === "entregue" && (
          <button
            onClick={() => h.onTogglePosVenda(o)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
              o.pos_venda_feito
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <Check className="h-3 w-3" />
            {o.pos_venda_feito ? "Pós-venda feito" : "Pós-venda pendente"}
          </button>
        )}
        <button
          onClick={() => h.onRemove(o.id)}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

function KanbanCard({ order, colId, h }: { order: Order; colId: string; h: CardHandlers }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => h.onOpenDetail(order)}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
      className="cursor-grab rounded-xl border border-black/5 bg-white p-3 shadow-sm transition-all hover:shadow-md active:scale-[0.99] active:cursor-grabbing"
    >
      <OrderCardBody order={order} colId={colId} h={h} />
    </article>
  );
}

function KanbanColumn({ col, orders: list, h }: { col: ColumnDef; orders: Order[]; h: CardHandlers }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section
      className="flex w-[280px] flex-col rounded-2xl shadow-sm sm:w-auto"
      style={{ backgroundColor: col.bg }}
    >
      <div
        className="flex items-center justify-between rounded-t-2xl px-3 py-2 text-sm font-semibold"
        style={{ backgroundColor: col.headerBg, color: col.headerText }}
      >
        <span>
          {col.emoji} {col.title}
        </span>
        <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs">{list.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-b-2xl p-2 transition-colors ${
          isOver ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : ""
        }`}
      >
        {list.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          list.map((o) => <KanbanCard key={o.id} order={o} colId={col.id} h={h} />)
        )}
      </div>
    </section>
  );
}

function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<Order | null>(null);
  const [banner, setBanner] = useState<{ name: string; total: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [motoboyWhatsapp, setMotoboyWhatsapp] = useState<string>("");
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const originalTitle = useRef<string>("");

  useEffect(() => {
    (async () => {
      const { data } = (await supabase
        .from("store_settings" as never)
        .select("value")
        .eq("key", "motoboy_whatsapp")
        .maybeSingle()) as unknown as { data: { value: string } | null };
      if (data?.value) setMotoboyWhatsapp(data.value);
    })();
  }, []);

  // Tick para "há X min"
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Título da aba com badge
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!originalTitle.current) originalTitle.current = document.title;
    document.title = unreadCount > 0 ? `🔴 (${unreadCount}) Pedidos — TonTon` : originalTitle.current;
  }, [unreadCount]);

  // Limpa contador ao focar a aba
  useEffect(() => {
    const onFocus = () => setUnreadCount(0);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const load = async () => {
    const { data } = (await supabase
      .from("orders" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)) as unknown as { data: Order[] | null };
    const list = data ?? [];

    if (firstLoad.current) {
      list.forEach((o) => knownIds.current.add(o.id));
      firstLoad.current = false;
    } else {
      const fresh = list.filter((o) => !knownIds.current.has(o.id) && o.status === "novo");
      if (fresh.length > 0) {
        const first = fresh[0];
        playBeep();
        setBanner({ name: first.customer_name, total: Number(first.total) });
        setUnreadCount((c) => c + fresh.length);
        setTimeout(() => setBanner(null), 5000);
      }
      list.forEach((o) => knownIds.current.add(o.id));
    }
    setOrders(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-orders-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Order[]> = {
      novo: [],
      em_producao: [],
      aguardando_entrega: [],
      na_rua: [],
      entregue: [],
    };
    orders.forEach((o) => {
      if (g[o.status]) g[o.status].push(o);
    });
    return g;
  }, [orders]);

  const updateStatus = async (id: string, status: string) => {
    // Otimista
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    const { error } = await (supabase
      .from("orders" as never)
      .update({ status } as never)
      .eq("id", id));
    if (error) {
      toast.error("Erro: " + error.message);
      load();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveOrder(orders.find((o) => o.id === String(event.active.id)) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;
    const order = orders.find((o) => o.id === String(active.id));
    const newStatus = String(over.id);
    if (!order || order.status === newStatus) return;
    updateStatus(order.id, newStatus);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esse pedido? Não tem como desfazer.")) return;
    const { error } = await (supabase.from("orders" as never).delete().eq("id", id));
    if (error) toast.error(error.message);
    else {
      toast.success("Pedido excluído");
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };

  const handleAccept = (o: Order) => {
    updateStatus(o.id, "em_producao");
    window.open(waLink(o.customer_phone, buildAcceptMsg(o)), "_blank");
  };

  const handleReject = (o: Order) => {
    if (!confirm(`Recusar pedido #${o.order_number}?`)) return;
    updateStatus(o.id, "cancelado");
    toast.success("Pedido recusado");
  };

  const handleReady = (o: Order) => {
    updateStatus(o.id, "aguardando_entrega");
    window.open(waLink(o.customer_phone, buildReadyMsg(o)), "_blank");
  };

  const handleDispatch = (o: Order) => {
    updateStatus(o.id, "na_rua");
    if (motoboyWhatsapp) {
      window.open(waLink(motoboyWhatsapp, buildMotoboyMsg(o)), "_blank");
    } else {
      toast.error("Cadastre o WhatsApp do motoboy em Configurações.");
    }
  };

  const handleDelivered = (o: Order) => updateStatus(o.id, "entregue");

  const togglePosVenda = async (o: Order) => {
    const pos_venda_feito = !o.pos_venda_feito;
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, pos_venda_feito } : x)));
    const { error } = await (supabase
      .from("orders" as never)
      .update({ pos_venda_feito } as never)
      .eq("id", o.id));
    if (error) {
      toast.error("Erro: " + error.message);
      load();
    }
  };

  const cardHandlers: CardHandlers = {
    now,
    onOpenDetail: setDetail,
    onAccept: handleAccept,
    onReject: handleReject,
    onReady: handleReady,
    onDispatch: handleDispatch,
    onDelivered: handleDelivered,
    onTogglePosVenda: togglePosVenda,
    onRemove: remove,
  };

  return (
    <div>
      {banner && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 rounded-2xl bg-green-600 px-5 py-3 text-white shadow-2xl">
          🆕 Novo pedido de <strong>{banner.name}</strong> — <strong>{brl(banner.total)}</strong>
        </div>
      )}

      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Painel em tempo real. Toque no card para detalhes ou arraste entre as colunas.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {orders.length} pedidos · atualizado agora
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex min-w-max gap-3 sm:grid sm:min-w-0 sm:grid-cols-2 lg:grid-cols-5">
              {COLUMNS.map((col) => (
                <KanbanColumn key={col.id} col={col} orders={grouped[col.id] ?? []} h={cardHandlers} />
              ))}
            </div>
            <DragOverlay>
              {activeOrder ? (
                <article className="w-[280px] rounded-xl border border-black/5 bg-white p-3 shadow-2xl">
                  <OrderCardBody order={activeOrder} colId={activeOrder.status} h={cardHandlers} />
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {detail && (
        <OrderDetailModal order={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
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
            <p className="font-display text-xl">#{order.order_number}</p>
            <p className="text-xs opacity-90">
              {new Date(order.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
            <p className="text-foreground">
              {order.customer_name} · {order.customer_phone}
            </p>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Itens</p>
            <ul className="mt-1 space-y-1 text-foreground">
              {(order.items ?? []).map((it, i) => (
                <li key={i}>
                  <strong>{it.quantity}×</strong> {it.productName}
                  {it.flavorLabels?.length ? ` — ${it.flavorLabels.join(", ")}` : ""}
                  {it.eventLabel ? ` (evento: ${it.eventLabel})` : ""} ·{" "}
                  <span className="text-muted-foreground">
                    {brl(Number(it.unitPrice) * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <p>
              <span className="text-muted-foreground">Subtotal:</span>{" "}
              {brl(Number(order.subtotal))}
            </p>
            <p>
              <span className="text-muted-foreground">Entrega:</span>{" "}
              {brl(Number(order.delivery_fee))}
            </p>
            <p className="col-span-2 font-display text-lg text-primary">
              Total: {brl(Number(order.total))}
            </p>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Endereço</p>
            {order.delivery_mode === "delivery" ? (
              <p className="text-foreground">
                {order.street}, {order.number}
                {order.complement ? ` — ${order.complement}` : ""}
                {order.neighborhood ? ` · ${order.neighborhood}` : ""}
                {order.city ? ` · ${order.city}` : ""}
              </p>
            ) : (
              <p className="text-foreground">Retirada no local</p>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</p>
            <p className="text-foreground">
              {order.payment_method === "pix" ? "PIX" : "Maquininha (na entrega)"}
            </p>
          </section>

          {order.notes && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Observação
              </p>
              <p className="text-foreground">{order.notes}</p>
            </section>
          )}
          {order.event_date && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Data do evento
              </p>
              <p className="text-foreground">
                {new Date(order.event_date).toLocaleString("pt-BR")}
              </p>
            </section>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 p-4">
          <a
            href={waLink(order.customer_phone, `Oi ${order.customer_name.split(" ")[0]}! Sobre o pedido #${order.order_number} 💜`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href={`tel:${order.customer_phone}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <Phone className="h-4 w-4" /> Ligar
          </a>
        </div>
      </div>
    </div>
  );
}

// referência usada para evitar warning ts não usado
void OWNER_WHATSAPP;
