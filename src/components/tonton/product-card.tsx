import { useMemo, useState } from "react";
import { Plus, Tag, CalendarClock, AlertTriangle } from "lucide-react";
import {
  type Product,
  COPO_FLAVORS,
  BOMBOM_FLAVORS,
  type Flavor,
} from "@/lib/menu-data";
import { useOrder } from "@/contexts/order-context";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trackPixel } from "@/lib/fbq";

function FlavorPicker({
  flavors,
  value,
  onChange,
  name,
  hidePrice,
}: {
  flavors: Flavor[];
  value: string | null;
  onChange: (id: string) => void;
  name: string;
  hidePrice?: boolean;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label={`Sabor — ${name}`}>
      {flavors.map((f) => {
        const selected = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(f.id)}
            className={`w-full rounded-xl border-2 p-3 text-left transition ${
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {f.image && (
                <img
                  src={f.image}
                  alt={f.name}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <span
                className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-primary" : "border-muted-foreground/40"
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{f.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
                {!hidePrice && typeof f.price === "number" && (
                  <p className="mt-1 text-xs font-bold text-primary">
                    R$ {f.price.toFixed(2).replace(".", ",")}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Default minimum date input value = today (yyyy-mm-dd). */
function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatEventLabel(date: string, time: string) {
  if (!date) return "";
  const dt = new Date(`${date}T${time || "12:00"}`);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProductCard({
  product,
  soldOut = false,
}: {
  product: Product;
  soldOut?: boolean;
}) {
  const { addItem, ensureCustomer, setCartOpen } = useOrder();
  const [open, setOpen] = useState(false);
  const [flavor, setFlavor] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [qty, setQty] = useState(product.minQuantity ?? 1);

  const needsFlavor = !!product.flavors;
  const needsPicks = !!product.flavorPicks;
  const needsSchedule = !!product.requiresScheduling;
  const requiresChoice = needsFlavor || needsPicks || needsSchedule;
  const minNotice = product.minNoticeHours ?? 24;

  const totalSteps =
    (needsFlavor ? 1 : 0) + (needsPicks ? product.flavorPicks!.length : 0);
  const showProgress = totalSteps > 1;

  const allPicksDone =
    !needsPicks ||
    product.flavorPicks!.every((p) => (picks[p.from]?.length ?? 0) === p.count);

  const scheduleInfo = useMemo(() => {
    if (!needsSchedule) return { ok: true, hours: Infinity, urgent: false };
    if (!eventDate) return { ok: false, hours: 0, urgent: false };
    const dt = new Date(`${eventDate}T${eventTime || "12:00"}`);
    const diffMs = dt.getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) return { ok: false, hours: 0, urgent: false };
    const hours = diffMs / 36e5;
    return { ok: true, hours, urgent: hours < minNotice };
  }, [needsSchedule, eventDate, eventTime, minNotice]);

  const canAdd =
    !soldOut &&
    (!needsFlavor || !!flavor) &&
    (!needsPicks || allPicksDone) &&
    (!needsSchedule || scheduleInfo.ok) &&
    qty >= (product.minQuantity ?? 1);

  const doAdd = (overrides?: { flavor?: string | null; picks?: Record<string, string[]> }) => {
    const useFlavor = overrides?.flavor !== undefined ? overrides.flavor : flavor;
    const usePicks = overrides?.picks ?? picks;
    const labels: string[] = [];
    let unitPrice = product.price;
    const isCombo = product.id.startsWith("combo-");
    if (needsFlavor && useFlavor) {
      const f = product.flavors!.find((x) => x.id === useFlavor);
      if (f) {
        labels.push(f.name);
        if (!isCombo && typeof f.price === "number") unitPrice = f.price;
      }
    }
    if (needsPicks) {
      product.flavorPicks!.forEach((p) => {
        const pool = p.from === "copo" ? COPO_FLAVORS : BOMBOM_FLAVORS;
        (usePicks[p.from] ?? []).forEach((id) => {
          const f = pool.find((x) => x.id === id);
          if (f) labels.push(f.name);
        });
      });
    }

    const eventLabel = needsSchedule ? formatEventLabel(eventDate, eventTime) : undefined;
    const isoEvent = needsSchedule
      ? new Date(`${eventDate}T${eventTime || "12:00"}`).toISOString()
      : undefined;

    const quantity = needsSchedule ? qty : 1;
    addItem({
      productId: product.id,
      productName: product.name,
      unitPrice,
      flavorLabels: labels,
      quantity,
      eventDate: isoEvent,
      eventLabel,
      needsConfirmation: needsSchedule && scheduleInfo.urgent,
    });

    trackPixel("AddToCart", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      contents: [{ id: product.id, quantity }],
      value: unitPrice * quantity,
      currency: "BRL",
    });

    if (needsSchedule && scheduleInfo.urgent) {
      toast.warning("Pedido recebido! Vamos confirmar disponibilidade pelo WhatsApp 💕", {
        action: { label: "Ver carrinho", onClick: () => setCartOpen(true) },
      });
    } else {
      toast.success(`${product.name} no carrinho 💜`, {
        action: { label: "Ver carrinho", onClick: () => setCartOpen(true) },
      });
    }

    setFlavor(null);
    setPicks({});
    setStepIdx(0);
    setEventDate("");
    setEventTime("");
    setQty(product.minQuantity ?? 1);
    setOpen(false);
  };

  const handleFlavorSelect = (id: string) => {
    setFlavor(id);
    if (needsSchedule) return;
    if (needsPicks) {
      setStepIdx(1);
      return;
    }
    ensureCustomer(() => doAdd({ flavor: id }));
  };

  const handlePickToggle = (bucket: string, id: string, max: number) => {
    setPicks((prev) => {
      const cur = prev[bucket] ?? [];
      let nextBucket: string[];
      if (cur.includes(id)) {
        nextBucket = cur.filter((x) => x !== id);
      } else if (cur.length >= max) {
        nextBucket = [...cur.slice(1), id];
      } else {
        nextBucket = [...cur, id];
      }
      const next = { ...prev, [bucket]: nextBucket };

      if (nextBucket.length === max) {
        const buckets = product.flavorPicks!;
        const bucketIdx = buckets.findIndex((p) => p.from === bucket);
        const isLast = bucketIdx === buckets.length - 1;
        const allDone = buckets.every(
          (p) => (next[p.from]?.length ?? 0) === p.count,
        );
        if (isLast && allDone && !needsSchedule) {
          ensureCustomer(() => doAdd({ picks: next }));
        } else if (!isLast) {
          const offset = needsFlavor ? 1 : 0;
          setStepIdx(offset + bucketIdx + 1);
        }
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (!canAdd) {
      if (soldOut) {
        toast.error("Esse item está esgotado no momento 💔");
      } else if (needsSchedule && !scheduleInfo.ok) {
        toast.error("Escolhe uma data válida pra festa 💕");
      } else {
        toast.error("Falta selecionar alguma coisa antes 💕");
      }
      return;
    }
    ensureCustomer(() => doAdd());
  };

  const hasPromo = product.originalPrice && product.originalPrice > product.price;
  const buttonLabel = "Pedir agora";

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      {/* Mobile-first list row: photo left, content right */}
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {product.image && (
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-32 sm:w-32">
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
                  decoding="async"
              className={`h-full w-full object-cover ${soldOut ? "grayscale opacity-60" : ""}`}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {soldOut ? (
            <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
              Esgotado
            </span>
          ) : (
            product.badge && (
              <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {product.badge}
              </span>
            )
          )}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-semibold leading-tight text-foreground sm:text-lg">
              {product.name}
            </h3>
          </div>

          {needsSchedule && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-chocolate">
              <CalendarClock className="h-3 w-3" /> Sob encomenda
            </span>
          )}

          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm sm:line-clamp-none">
            {product.description}
          </p>

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="min-w-0">
              {hasPromo && (
                <p className="text-[11px] text-muted-foreground line-through">
                  {brl(product.originalPrice!)}
                </p>
              )}
              <p className="font-display text-xl font-bold leading-none text-primary sm:text-2xl">
                {brl(product.price)}
                {product.unitLabel && (
                  <span className="ml-1 text-xs font-medium text-muted-foreground">
                    {product.unitLabel}
                  </span>
                )}
              </p>
            </div>
            {soldOut ? (
              <Button size="sm" disabled className="shrink-0 rounded-full">
                Esgotado
              </Button>
            ) : !requiresChoice ? (
              <Button
                onClick={handleAdd}
                size="sm"
                className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow"
              >
                Pedir agora
              </Button>
            ) : (
              <Button
                onClick={() => setOpen((v) => !v)}
                size="sm"
                variant={open ? "secondary" : "default"}
                className={
                  open
                    ? "shrink-0"
                    : "shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow"
                }
              >
                {open ? "Fechar" : buttonLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

      {open && requiresChoice && (() => {
        // Build step list (only auto-advance steps; schedule renders alongside)
        const steps: Array<
          | { kind: "flavor" }
          | { kind: "pick"; bucket: "copo" | "bombom"; count: number; label: string }
        > = [];
        if (needsFlavor) steps.push({ kind: "flavor" });
        if (needsPicks) {
          product.flavorPicks!.forEach((p) => {
            steps.push({
              kind: "pick",
              bucket: p.from,
              count: p.count,
              label: p.from === "copo" ? "Copo" : "Bombom",
            });
          });
        }
        const current = steps[Math.min(stepIdx, steps.length - 1)];
        const stepTitle = current
          ? current.kind === "flavor"
            ? needsPicks
              ? `Escolha o sabor (${stepIdx + 1}/${steps.length})`
              : product.flavors?.[0]?.price !== product.flavors?.[1]?.price
                ? "Escolha a opção"
                : "Escolha o sabor"
            : `Escolha o ${current.label} (${stepIdx + 1}/${steps.length})`
          : "";

        return (
          <div className="space-y-4 border-t border-border bg-muted/30 p-4 sm:p-5">
            {(showProgress || (steps.length === 1 && current)) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {stepTitle}
                </p>
                {showProgress && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {current && current.kind === "flavor" && (
              <div key={`step-flavor-${stepIdx}`} className="animate-fade-in">
                <FlavorPicker
                  flavors={product.flavors!}
                  value={flavor}
                  onChange={handleFlavorSelect}
                  name={product.name}
                  hidePrice={product.id.startsWith("combo-")}
                />
              </div>
            )}

            {current && current.kind === "pick" && (() => {
              const pool = current.bucket === "copo" ? COPO_FLAVORS : BOMBOM_FLAVORS;
              const cur = picks[current.bucket] ?? [];
              return (
                <div key={`step-pick-${stepIdx}`} className="animate-fade-in space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Selecionados: {cur.length}/{current.count}
                  </p>
                  <div className="space-y-2">
                    {pool.map((f) => {
                      const selected = cur.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handlePickToggle(current.bucket, f.id, current.count)}
                          className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          {f.image && (
                            <img
                              src={f.image}
                              alt={f.name}
                              loading="lazy"
                              decoding="async"
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{f.name}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {f.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {needsSchedule && (
              <div className="space-y-3 rounded-xl border border-gold/40 bg-card p-4">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarClock className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Agendar entrega/retirada
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Data
                    </span>
                    <input
                      type="date"
                      min={todayStr()}
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Horário
                    </span>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantidade {product.unitLabel ? `(${product.unitLabel.replace("/ ", "")})` : ""}
                  </span>
                  <input
                    type="number"
                    min={product.minQuantity ?? 1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                {scheduleInfo.ok && scheduleInfo.urgent && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <strong>Menos de {minNotice}h de antecedência.</strong> Aceitamos o
                      pedido, mas <strong>vamos confirmar a disponibilidade pelo WhatsApp</strong>{" "}
                      antes de começar a produção.
                    </p>
                  </div>
                )}

                {!scheduleInfo.ok && eventDate && (
                  <p className="text-xs text-destructive">
                    Escolha uma data e horário no futuro 🗓️
                  </p>
                )}

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  💡 Recomendamos agendar com pelo menos {minNotice}h de antecedência pra
                  garantir vaga na agenda.
                </p>

                <Button
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
                  size="lg"
                >
                  Confirmar pedido
                </Button>
              </div>
            )}
          </div>
        );
      })()}


    </article>
  );
}
