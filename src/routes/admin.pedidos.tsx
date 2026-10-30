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
import { paymentLabel } from "@/lib/payment";
import { DEFAULT_PIX_KEY, getPixKey } from "@/lib/pix";
import { ORDERS_CHANGED_EVENT } from "@/lib/order-alerts";
import { GIFT_INTERNAL_LABEL, GIFT_PRODUCT_ID } from "@/lib/gift";
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

// Chave PIX das mensagens: começa com a padrão e troca pela de Configurações assim que carrega.
let PIX_KEY = DEFAULT_PIX_KEY;
const STORE_ADDRESS_SHORT = "Rua Pedro Lombardi, 890 — Vila Mineirão";

type OrderItem = {
  productId?: string;
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
  discount: number | null;
  delivery_km: number | null;
  cep: string | null;
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
  { id: "aguardando_entrega", title: "Pronto", emoji: "📦", bg: "#fef3c7", headerBg: "#d97706", headerText: "#fff" },
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
  const isDelivery = o.delivery_mode === "delivery";
  const pay =
    o.payment_method === "pix"
      ? `\n\nChave PIX: ${PIX_KEY} (aparece no banco como Izana Maia)\nValor: ${brl(Number(o.total))}`
      : o.payment_method === "link"
        ? ""
        : isDelivery
          ? `\n\nPagamento na entrega na maquininha 💳`
          : `\n\nPagamento na retirada na maquininha 💳`;
  const ready =
    o.delivery_mode === "uber"
      ? `Oi ${first}! 🍫 Seu pedido #${o.order_number} está prontinho! Pode chamar o Uber agora e colar este endereço: ${STORE_ADDRESS_SHORT}, Sorocaba. 💕`
      : isDelivery
        ? `Oi ${first}! 🍫 Seu pedido #${o.order_number} está prontinho e já vamos providenciar a entrega! 💕`
        : `Oi ${first}! 🍫 Seu pedido #${o.order_number} está prontinho! Pode vir retirar: ${STORE_ADDRESS_SHORT}. 💕`;
  return `${ready}${pay}`;
}

function buildMotoboyMsg(o: Order) {
  const enderecoLine =
    o.delivery_mode === "delivery"
      ? `${o.street ?? ""}, ${o.number ?? ""}${o.complement ? ` — ${o.complement}` : ""} — ${o.neighborhood ?? ""} — ${o.city ?? ""}`
      : "Retirada no local";
  const pagamentoLine =
    o.payment_method === "pix"
      ? "PIX (já pago)"
      : o.payment_method === "link"
        ? "Link de pagamento (pago online)"
        : "Maquininha (cobrar na entrega)";
  const link =
    typeof window !== "undefined" ? `${window.location.origin}/entrega/${o.id}` : "";
  return `🛵 Nova entrega — TonTon Doces\n${o.customer_name} — ${brl(Number(o.total))} (${pagamentoLine})\n\n📍 ${enderecoLine}\n\nVer pedido completo:\n${link}`;
}

function receivingLabel(o: Order) {
  if (o.delivery_mode === "uber") return "Uber";
  if (o.delivery_mode === "delivery") return o.neighborhood ?? "Entrega";
  return "Retirada";
}

function buildReviewMsg(o: Order) {
  const first = o.customer_name.split(" ")[0];
  return `Oi ${first}! Seu pedido chegou bem? 💕 Ficamos muito felizes em fazer parte do seu dia com nossos docinhos!\n\nSe tiver 1 minutinho, avalia a gente no Google? Conta muito pra nós 🙏\nhttps://g.page/r/CaMj6sbfDrdLEBM/review`;
}

type CardHandlers = {
  now: number;
  onOpenDetail: (o: Order) => void;
  onAccept: (o: Order) => void;
  onReject: (o: Order) => void;
  onReady: (o: Order) => void;
  onNotify: (o: Order) => void;
  onDispatch: (o: Order) => void;
  onDelivered: (o: Order) => void;
  onAskReview: (o: Order) => void;
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
        {receivingLabel(o)} · {o.payment_method === "link" ? "Link" : paymentLabel(o.payment_method)}
      </p>
      <p className="mt-1 font-display text-lg text-primary">{brl(Number(o.total))}</p>
      {(o.items ?? []).some((it) => it.productId === GIFT_PRODUCT_ID) && (
        <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
          🎁 {GIFT_INTERNAL_LABEL}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {colId !== "aguardando_entrega" && (
          <a
            href={waLink(o.customer_phone, `Oi ${o.customer_name.split(" ")[0]}! Sobre o pedido #${o.order_number} 💜`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800 hover:bg-green-200"
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>
        )}

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
        {colId === "aguardando_entrega" &&
          (o.delivery_mode === "delivery" ? (
            <button
              onClick={() => h.onDispatch(o)}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
            >
              <MessageCircle className="h-3 w-3" /> Enviar pro motoboy
            </button>
          ) : (
            <>
              <button
                onClick={() => h.onNotify(o)}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                <MessageCircle className="h-3 w-3" /> Avisar cliente
              </button>
              <button
                onClick={() => h.onDelivered(o)}
                className="inline-flex items-center gap-1 rounded-md bg-gray-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-gray-800"
              >
                <Check className="h-3 w-3" /> Entregue
              </button>
            </>
          ))}
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
            onClick={() => h.onAskReview(o)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
              o.pos_venda_feito
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-gold/20 text-chocolate hover:bg-gold/30"
            }`}
          >
            {o.pos_venda_feito ? (
              <>
                <Check className="h-3 w-3" /> Avaliação pedida
              </>
            ) : (
              <>⭐ Pedir avaliação</>
            )}
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
  const [motoboyWhatsapp, setMotoboyWhatsapp] = useState<string>("");
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => {
    void getPixKey().then((k) => {
      PIX_KEY = k;
    });
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

  const load = async () => {
    const { data } = (await supabase
      .from("orders" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)) as unknown as { data: Order[] | null };
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Tempo real (se estiver ligado no banco) + conferência a cada 20 s + quando o aviso do painel
    // achar pedido novo: o quadro nunca fica desatualizado.
    const channel = supabase
      .channel("admin-orders-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const id = setInterval(load, 20_000);
    window.addEventListener(ORDERS_CHANGED_EVENT, load);
    return () => {
      clearInterval(id);
      window.removeEventListener(ORDERS_CHANGED_EVENT, load);
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

  const handleNotify = (o: Order) => {
    window.open(waLink(o.customer_phone, buildReadyMsg(o)), "_blank");
  };

  const handleDispatch = (o: Order) => {
    if (!motoboyWhatsapp) {
      toast.error("Cadastre o WhatsApp do motoboy em Configurações.");
      return;
    }
    updateStatus(o.id, "na_rua");
    window.open(waLink(motoboyWhatsapp, buildMotoboyMsg(o)), "_blank");
  };

  const handleDelivered = (o: Order) => updateStatus(o.id, "entregue");

  const markPosVenda = async (o: Order, pos_venda_feito: boolean) => {
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

  const handleAskReview = (o: Order) => {
    window.open(waLink(o.customer_phone, buildReviewMsg(o)), "_blank");
    if (!o.pos_venda_feito) markPosVenda(o, true);
  };

  const cardHandlers: CardHandlers = {
    now,
    onOpenDetail: setDetail,
    onAccept: handleAccept,
    onReject: handleReject,
    onReady: handleReady,
    onNotify: handleNotify,
    onDispatch: handleDispatch,
    onDelivered: handleDelivered,
    onAskReview: handleAskReview,
    onRemove: remove,
  };

  return (
    <div>
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
                  <strong>{it.quantity}×</strong>{" "}
                  {it.productId === GIFT_PRODUCT_ID ? `🎁 ${GIFT_INTERNAL_LABEL}` : it.productName}
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
              <span className="text-muted-foreground">Subtotal:</span> {brl(Number(order.subtotal))}
            </p>
            {Number(order.discount) > 0 && (
              <p className="text-green-700">
                <span>Desconto 2 por R$ 40:</span> − {brl(Number(order.discount))}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Entrega:</span>{" "}
              {order.delivery_mode === "delivery"
                ? `${brl(Number(order.delivery_fee))}${order.delivery_km ? ` (${String(order.delivery_km).replace(".", ",")} km)` : ""}`
                : "—"}
            </p>
            <p className="col-span-2 font-display text-lg text-primary">
              Total: {brl(Number(order.total))}
            </p>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Recebimento</p>
            {order.delivery_mode === "delivery" ? (
              <p className="text-foreground">
                {order.street}, {order.number}
                {order.complement ? ` — ${order.complement}` : ""}
                {order.neighborhood ? ` · ${order.neighborhood}` : ""}
                {order.city ? ` · ${order.city}` : ""}
                {order.cep ? ` · CEP ${order.cep}` : ""}
              </p>
            ) : order.delivery_mode === "uber" ? (
              <p className="text-foreground">
                Uber — o cliente chama quando avisarmos que está pronto
              </p>
            ) : (
              <p className="text-foreground">Retirada na loja</p>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</p>
            <p className="text-foreground">
              {order.payment_method === "pix" || order.payment_method === "link"
                ? paymentLabel(order.payment_method)
                : order.delivery_mode === "delivery"
                  ? "Cartão (na entrega)"
                  : "Cartão (na retirada)"}
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
