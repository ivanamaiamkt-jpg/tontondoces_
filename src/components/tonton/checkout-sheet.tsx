import { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  Heart,
  Copy,
  MessageCircle,
  ArrowLeft,
  Store,
  Car,
  Bike,
  Loader2,
} from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { OWNER_WHATSAPP, STORE_ADDRESS } from "@/lib/menu-data";
import { useMinOrder } from "@/lib/min-order";
import { PAIR_PROMO_LABEL } from "@/lib/pair-promo";
import { brl, maskPhone, maskCep } from "@/lib/format";
import {
  lookupCepClient,
  quoteDelivery,
  useDeliverySettings,
  SOROCABA_IBGE,
  type CepInfo,
  type DeliveryQuote,
} from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackPixel } from "@/lib/fbq";
import { syncAbandonedCart, markCartConverted } from "@/lib/abandoned-cart";
import { getStoredUtm } from "@/lib/analytics";
import { getStoreStatus } from "@/lib/store-hours";
import { isPaused, PAUSE_WHATSAPP_NOTE } from "@/lib/pause-mode";

const PIX_KEY = "diretorios.tonton@gmail.com";

type Receiving = "pickup" | "uber" | "delivery";

type CepState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ok"; info: CepInfo }
  | { kind: "othercity"; info: CepInfo };

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; quote: DeliveryQuote }
  | { kind: "error" };

const STEP_LABELS = ["Quem é você?", "Como você quer receber?", "Confirmar pedido"];

const RECEIVING_WHATSAPP: Record<Receiving, string> = {
  pickup: "Retirada na loja",
  uber: "Uber (cliente chama quando avisarmos)",
  delivery: "Entrega",
};

const RECEIVING_SUMMARY: Record<Receiving, string> = {
  pickup: "Retirada na loja",
  uber: "Uber (você chama)",
  delivery: "Entrega",
};

export function CheckoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, discount, clearCart, setCartOpen, customer } = useOrder();
  const MIN_ORDER = useMinOrder();
  const delivery = useDeliverySettings();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ? maskPhone(customer.phone) : "");
  const [receiving, setReceiving] = useState<Receiving | null>(null);
  const [payment, setPayment] = useState<"pix" | "maquininha">("pix");
  const [notes, setNotes] = useState("");
  const [cep, setCep] = useState("");
  const [cepState, setCepState] = useState<CepState>({ kind: "idle" });
  const [streetTyped, setStreetTyped] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: "idle" });
  const cepSeq = useRef(0);
  const quoteSeq = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    orderId: string;
    payment: "pix" | "maquininha";
    total: number;
    name: string;
    summary: string;
    receiving: Receiving;
    addressLine?: string;
  } | null>(null);
  const [sent, setSent] = useState(false);
  const [storeStatus, setStoreStatus] = useState(() => getStoreStatus());

  useEffect(() => {
    const id = setInterval(() => setStoreStatus(getStoreStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (customer?.name && !name) setName(customer.name);
    if (customer?.phone && !phone) setPhone(maskPhone(customer.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.name, customer?.phone]);

  // Consulta o CEP assim que tiver 8 dígitos (só preenche a tela; quem decide é o servidor).
  const handleCepChange = (v: string) => {
    const masked = maskCep(v);
    setCep(masked);
    setQuoteState({ kind: "idle" });
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) {
      cepSeq.current++;
      setCepState({ kind: "idle" });
      return;
    }
    const seq = ++cepSeq.current;
    setCepState({ kind: "loading" });
    lookupCepClient(digits)
      .then((info) => {
        if (seq !== cepSeq.current) return;
        if (!info) return setCepState({ kind: "notfound" });
        const inSorocaba = info.ibge === SOROCABA_IBGE && info.state.toUpperCase() === "SP";
        setStreetTyped(info.street);
        setCepState(inSorocaba ? { kind: "ok", info } : { kind: "othercity", info });
      })
      .catch(() => {
        if (seq === cepSeq.current) setCepState({ kind: "error" });
      });
  };

  // Calcula a taxa quando CEP + número estão preenchidos (espera o cliente parar de digitar).
  const cepDigits = cep.replace(/\D/g, "");
  const cepOk = cepState.kind === "ok";
  useEffect(() => {
    if (receiving !== "delivery" || !cepOk || number.trim() === "" || streetTyped.trim() === "") {
      quoteSeq.current++;
      setQuoteState({ kind: "idle" });
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoteState({ kind: "loading" });
    const timer = setTimeout(() => {
      quoteDelivery({ data: { cep: cepDigits, number: number.trim(), street: streetTyped.trim() } })
        .then((quote) => {
          if (seq === quoteSeq.current) setQuoteState({ kind: "done", quote });
        })
        .catch(() => {
          if (seq === quoteSeq.current) setQuoteState({ kind: "error" });
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [receiving, cepOk, cepDigits, number, streetTyped]);

  if (!open) return null;

  const phoneDigits = phone.replace(/\D/g, "");
  const step1Valid = name.trim().length >= 2 && phoneDigits.length >= 10;
  const approvedQuote =
    quoteState.kind === "done" && quoteState.quote.status === "ok" ? quoteState.quote : null;
  const deliveryFee = receiving === "delivery" && approvedQuote ? approvedQuote.fee : 0;
  const total = subtotal - discount + deliveryFee;
  const step2Valid =
    receiving === "pickup" ||
    receiving === "uber" ||
    (receiving === "delivery" && approvedQuote !== null);
  // Com Uber o pagamento é sempre PIX adiantado (o motorista não leva maquininha).
  const effectivePayment: "pix" | "maquininha" = receiving === "uber" ? "pix" : payment;

  const chooseReceiving = (r: Receiving) => {
    setReceiving(r);
    if (r === "uber") setPayment("pix");
  };

  const addressLine =
    receiving === "delivery" && approvedQuote
      ? `${approvedQuote.address.street}, ${number.trim()}${complement.trim() ? ` — ${complement.trim()}` : ""} — ${approvedQuote.address.neighborhood} — ${approvedQuote.address.city} — CEP ${approvedQuote.address.cep}`
      : "";

  const whatsappConfirmLink = () => {
    const info = cepState.kind === "ok" || cepState.kind === "othercity" ? cepState.info : null;
    const msg =
      `Oi TonTon! 💜 Quero pedir com entrega, mas o site não conseguiu calcular a taxa.\n` +
      `CEP: ${cep}${info?.street ? ` — ${info.street}` : ""}, nº ${number || "?"}${complement ? ` (${complement})` : ""}\n` +
      `Pode confirmar a taxa pra mim?`;
    return `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  const handleSubmit = async () => {
    if (!step1Valid || !receiving || !step2Valid || submitting || subtotal < MIN_ORDER) return;
    setSubmitting(true);
    const orderId = `TT-${Date.now().toString().slice(-6)}`;

    try {
      await supabase.from("orders" as never).insert({
        order_number: orderId,
        customer_id: customer?.id ?? null,
        customer_name: name,
        customer_phone: phoneDigits,
        delivery_mode: receiving,
        ...(receiving === "delivery" && approvedQuote
          ? {
              street: approvedQuote.address.street,
              number: number.trim(),
              complement: complement.trim() || null,
              neighborhood: approvedQuote.address.neighborhood,
              city: approvedQuote.address.city,
              cep: approvedQuote.address.cep,
              delivery_km: approvedQuote.km,
            }
          : {}),
        items: items as unknown as object,
        subtotal,
        ...(discount > 0 ? { discount } : {}),
        delivery_fee: deliveryFee,
        total,
        payment_method: effectivePayment,
        notes: notes || null,
        status: "novo",
        ...getStoredUtm(),
      } as never);
    } catch (e) {
      console.error("Erro ao salvar pedido:", e);
    }

    const lines: string[] = [];
    lines.push(`*Novo pedido TonTon Doces #${orderId}*`);
    lines.push("");
    lines.push(`*Cliente:* ${name}`);
    lines.push(`*WhatsApp:* ${phone}`);
    lines.push("");
    lines.push("*Itens:*");
    items.forEach((it) => {
      lines.push(`• ${it.quantity}x ${it.productName} — ${brl(it.unitPrice * it.quantity)}`);
      it.flavorLabels.forEach((l) => lines.push(`   ↳ ${l}`));
      if (it.eventLabel) lines.push(`   📅 Festa: ${it.eventLabel}`);
      if (it.needsConfirmation) lines.push(`   ⚠️ Menos de 24h — sujeito a confirmação`);
    });
    lines.push("");
    if (discount > 0) {
      lines.push(`*Subtotal:* ${brl(subtotal)}`);
      lines.push(`*Desconto ${PAIR_PROMO_LABEL}:* − ${brl(discount)}`);
    }
    lines.push(`*Recebimento:* ${RECEIVING_WHATSAPP[receiving]}`);
    if (receiving === "delivery" && approvedQuote) {
      lines.push(`*Endereço:* ${addressLine}`);
      lines.push(
        `*Taxa de entrega:* ${brl(deliveryFee)} (${String(approvedQuote.km).replace(".", ",")} km${approvedQuote.precise ? "" : ", distância estimada"})`,
      );
      if (discount === 0) lines.push(`*Subtotal:* ${brl(subtotal)}`);
    }
    lines.push(`*Total:* ${brl(total)}`);
    lines.push("");
    lines.push(
      `*Pagamento:* ${effectivePayment === "pix" ? "PIX (chave enviada após confirmação)" : receiving === "delivery" ? "Cartão (débito ou crédito na entrega)" : "Cartão (débito ou crédito na retirada)"}`,
    );
    if (notes) lines.push(`*Observações:* ${notes}`);
    if (isPaused()) {
      lines.push("");
      lines.push(PAUSE_WHATSAPP_NOTE);
    }

    const summary = lines.join("\n");
    await markCartConverted();

    trackPixel("Purchase", {
      value: total,
      currency: "BRL",
      contents: items.map((it) => ({ id: it.productId, quantity: it.quantity })),
      content_type: "product",
      num_items: items.reduce((s, it) => s + it.quantity, 0),
      order_id: orderId,
    });

    if (name && phoneDigits.length >= 10) {
      void syncAbandonedCart({ nome: name, telefone: phoneDigits, items });
    }

    setConfirmed({
      orderId,
      payment: effectivePayment,
      total,
      name,
      summary,
      receiving,
      addressLine: addressLine || undefined,
    });
    setSent(false);
    setSubmitting(false);
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      toast.success("Chave PIX copiada! 💜");
    } catch {
      toast.error("Não consegui copiar — copia manualmente 💕");
    }
  };

  const sendWhatsapp = () => {
    if (!confirmed) return;
    const header =
      confirmed.payment === "pix"
        ? `Oi TonTon! 💜 Sou ${confirmed.name}. Segue meu pedido (vou enviar o comprovante do PIX em seguida):\n\n`
        : `Oi TonTon! 💜 Sou ${confirmed.name}. Segue meu pedido:\n\n`;
    const msg = encodeURIComponent(header + confirmed.summary);
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${msg}`, "_blank");
    try {
      localStorage.setItem(
        "tonton_ultimo_pedido",
        JSON.stringify({
          items,
          total: confirmed.total,
          savedAt: Date.now(),
        }),
      );
      sessionStorage.removeItem("tonton_ultimo_pedido_dispensado");
    } catch {
      // ignore
    }
    setSent(true);
  };

  const finishAndClose = () => {
    clearCart();
    setConfirmed(null);
    setSent(false);
    setStep(1);
    onClose();
    setCartOpen(false);
  };

  const goNext = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const optionCls = (selected: boolean) =>
    `w-full rounded-2xl border-2 p-4 text-left transition ${
      selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-primary/70 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            {!confirmed && step > 1 && (
              <button onClick={goBack} className="rounded-full p-1 hover:bg-primary-glow" aria-label="Voltar">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="font-display text-xl">
              {confirmed ? (sent ? "Pedido enviado!" : "Estamos quase lá 💜") : STEP_LABELS[step - 1]}
            </h2>
          </div>
          <button
            onClick={confirmed ? finishAndClose : onClose}
            className="rounded-full p-1 hover:bg-primary-glow"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!confirmed && (
          <div className="border-b border-border bg-card px-5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Passo {step} de 3</span>
              <span>{Math.round((step / 3) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {confirmed ? (
          <div className="flex-1 overflow-y-auto p-6 text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 font-display text-2xl text-foreground">
              {sent ? "Pedido enviado! ✓" : "Estamos quase lá 💜"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Pedido <strong>#{confirmed.orderId}</strong> — total{" "}
              <strong>{brl(confirmed.total)}</strong>
              <br />
              Forma de pagamento:{" "}
              <strong>
                {confirmed.payment === "pix"
                  ? "PIX"
                  : confirmed.receiving === "delivery"
                    ? "Cartão na entrega"
                    : "Cartão na retirada"}
              </strong>
            </p>

            {confirmed.payment === "pix" && (
              <div className="mt-5 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left">
                <p className="font-display text-sm font-semibold text-primary">
                  💳 Chave PIX (e-mail)
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <code className="flex-1 truncate text-sm font-medium text-foreground">
                    {PIX_KEY}
                  </code>
                  <button
                    onClick={copyPix}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-glow"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Após pagar, envie o comprovante junto com o pedido pelo WhatsApp 💕
                </p>
              </div>
            )}

            {confirmed.payment === "maquininha" && (
              <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-left text-sm text-chocolate">
                {confirmed.receiving === "delivery"
                  ? "💳 Pagamento na entrega — débito ou crédito na maquininha."
                  : "💳 Pagamento na retirada — débito ou crédito na maquininha."}
              </div>
            )}

            {confirmed.receiving === "delivery" ? (
              <div className="mt-5 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left">
                <p className="font-display text-sm font-semibold text-primary">
                  🛵 Entrega — em média {delivery.etaMin} minutos
                </p>
                <p className="mt-2 text-sm text-foreground">{confirmed.addressLine}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Avisamos no WhatsApp quando o pedido sair 💕
                </p>
              </div>
            ) : (
            <div className="mt-5 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left">
              <p className="font-display text-sm font-semibold text-primary">
                {confirmed.receiving === "uber"
                  ? "🚗 Endereço da loja (pra chamar seu Uber)"
                  : "📍 Endereço da loja (pra retirar)"}
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <code className="flex-1 text-sm font-medium text-foreground">{STORE_ADDRESS}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(STORE_ADDRESS);
                    toast.success("Endereço copiado!");
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-glow"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {confirmed.receiving === "uber"
                  ? "Quando avisarmos que está pronto, cole esse endereço no app do Uber/99."
                  : "Avisamos no WhatsApp quando estiver pronto 💕"}
              </p>
            </div>
            )}

            {!sent ? (
              <>
                <Button
                  onClick={sendWhatsapp}
                  size="lg"
                  className="mt-5 w-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#1fb955]"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  📲 Enviar pedido pelo WhatsApp
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Seu pedido só será confirmado após o envio pelo WhatsApp.
                </p>
              </>
            ) : (
              <>
                <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
                  <p className="flex items-center gap-2 text-primary">
                    <Heart className="h-4 w-4 fill-primary" /> Obrigada pela preferência!
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Cada doce é feito com muito carinho aqui na TonTon Doces.
                  </p>
                </div>
                <Button
                  onClick={sendWhatsapp}
                  variant="outline"
                  size="lg"
                  className="mt-3 w-full"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Reenviar pelo WhatsApp
                </Button>
                <Button
                  onClick={finishAndClose}
                  variant="ghost"
                  className="mt-2 w-full"
                  size="lg"
                >
                  Voltar pro cardápio
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {step === 1 && (
                <>
                  <div>
                    <Label>Seu nome *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                      placeholder="Como prefere ser chamada"
                    />
                  </div>
                  <div>
                    <Label>WhatsApp *</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.target.value))}
                      className="mt-1"
                      placeholder="(11) 99999-9999"
                      inputMode="tel"
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  {delivery.enabled && (
                    <>
                      <button
                        type="button"
                        aria-pressed={receiving === "delivery"}
                        onClick={() => chooseReceiving("delivery")}
                        className={optionCls(receiving === "delivery")}
                      >
                        <div className="flex items-start gap-3">
                          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div>
                            <div className="font-semibold text-foreground">Entrega</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Entrega própria — em média {delivery.etaMin} minutos. Taxa
                              calculada pelo seu endereço (até {delivery.maxKm} km da loja).
                            </div>
                          </div>
                        </div>
                      </button>

                      {receiving === "delivery" && (
                        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                          <div>
                            <Label>CEP *</Label>
                            <Input
                              value={cep}
                              onChange={(e) => handleCepChange(e.target.value)}
                              className="mt-1"
                              placeholder="00000-000"
                              inputMode="numeric"
                              autoComplete="postal-code"
                            />
                            {cepState.kind === "loading" && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Buscando o CEP...
                              </p>
                            )}
                            {cepState.kind === "notfound" && (
                              <p className="mt-1 text-xs text-destructive">
                                CEP não encontrado. Confere o número?
                              </p>
                            )}
                            {cepState.kind === "error" && (
                              <p className="mt-1 text-xs text-destructive">
                                Não consegui consultar o CEP. Tenta de novo?
                              </p>
                            )}
                          </div>

                          {cepState.kind === "othercity" && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                              Entregamos só em Sorocaba. Pra outra cidade, você pode chamar um Uber.
                            </div>
                          )}

                          {cepState.kind === "ok" && (
                            <>
                              <div>
                                <Label>Rua *</Label>
                                <Input
                                  value={streetTyped}
                                  onChange={(e) => setStreetTyped(e.target.value)}
                                  readOnly={cepState.info.street !== ""}
                                  className="mt-1"
                                  placeholder="Nome da rua"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {cepState.info.neighborhood} · {cepState.info.city}/
                                  {cepState.info.state}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>Número *</Label>
                                  <Input
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value.slice(0, 12))}
                                    className="mt-1"
                                    placeholder="123"
                                    inputMode="numeric"
                                  />
                                </div>
                                <div>
                                  <Label>Complemento</Label>
                                  <Input
                                    value={complement}
                                    onChange={(e) => setComplement(e.target.value)}
                                    className="mt-1"
                                    placeholder="Apto, bloco..."
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {quoteState.kind === "loading" && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Calculando a taxa de
                              entrega...
                            </p>
                          )}
                          {quoteState.kind === "error" && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                              Não consegui calcular a taxa agora. Tenta de novo em instantes, ou
                              chama a gente no WhatsApp.
                            </div>
                          )}
                          {quoteState.kind === "done" && quoteState.quote.status === "ok" && (
                            <div className="rounded-xl border border-green-300 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800">
                              Entrega para {quoteState.quote.address.neighborhood}:{" "}
                              <strong>{brl(quoteState.quote.fee)}</strong> (
                              {String(quoteState.quote.km).replace(".", ",")} km). Tempo médio:{" "}
                              {delivery.etaMin} minutos.
                            </div>
                          )}
                          {quoteState.kind === "done" &&
                            quoteState.quote.status === "out" &&
                            quoteState.quote.reason === "distancia" && (
                              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                                Esse endereço fica fora da nossa área de entrega (até{" "}
                                {delivery.maxKm} km da loja). Você pode retirar na loja ou chamar
                                um Uber.
                              </div>
                            )}
                          {quoteState.kind === "done" &&
                            quoteState.quote.status === "out" &&
                            quoteState.quote.reason === "cidade" && (
                              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                                Entregamos só em Sorocaba. Pra outra cidade, você pode chamar um
                                Uber.
                              </div>
                            )}
                          {quoteState.kind === "done" && quoteState.quote.status === "invalid" && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                              Confere o CEP e o número do endereço.
                            </div>
                          )}
                          {quoteState.kind === "done" && quoteState.quote.status === "confirm" && (
                            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                              <p>
                                Não consegui confirmar a distância desse endereço. Chama a gente
                                no WhatsApp que a gente confirma a taxa, ou escolhe retirar ou
                                Uber.
                              </p>
                              <a
                                href={whatsappConfirmLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1fb955]"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> Confirmar pelo WhatsApp
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    aria-pressed={receiving === "pickup"}
                    onClick={() => chooseReceiving("pickup")}
                    className={optionCls(receiving === "pickup")}
                  >
                    <div className="flex items-start gap-3">
                      <Store className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <div className="font-semibold text-foreground">Retirar na loja</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Rua Pedro Lombardi, 890 — Vila Mineirão. Avisamos no WhatsApp quando
                          estiver pronto.
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={receiving === "uber"}
                    onClick={() => chooseReceiving("uber")}
                    className={optionCls(receiving === "uber")}
                  >
                    <div className="flex items-start gap-3">
                      <Car className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <div className="font-semibold text-foreground">Vou chamar um Uber</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Você chama o Uber (ou moto) pra buscar aqui. Avisamos no WhatsApp quando
                          estiver pronto, aí é só chamar.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {step === 3 && receiving && (
                <>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-display text-sm font-semibold text-primary">Itens</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {items.map((it) => (
                        <li key={it.lineId} className="flex justify-between gap-3">
                          <span className="text-foreground">
                            {it.quantity}× {it.productName}
                            {it.flavorLabels.length > 0 && (
                              <span className="block text-xs text-muted-foreground">
                                {it.flavorLabels.join(", ")}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-medium">{brl(it.unitPrice * it.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <Label>Forma de pagamento</Label>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setPayment("pix")}
                        className={`rounded-xl border-2 p-3 text-left text-sm transition ${
                          effectivePayment === "pix"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="font-semibold text-foreground">💸 PIX</div>
                        <div className="text-xs text-muted-foreground">
                          Chave enviada após confirmação do pedido
                        </div>
                      </button>
                      {(receiving === "pickup" || receiving === "delivery") && (
                        <button
                          type="button"
                          onClick={() => setPayment("maquininha")}
                          className={`rounded-xl border-2 p-3 text-left text-sm transition ${
                            effectivePayment === "maquininha"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="font-semibold text-foreground">💳 Cartão</div>
                          <div className="text-xs text-muted-foreground">
                            {receiving === "delivery"
                              ? "Débito ou crédito na entrega"
                              : "Débito ou crédito na retirada"}
                          </div>
                        </button>
                      )}
                    </div>
                    {receiving === "uber" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Com Uber o pagamento é só por PIX, adiantado.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1"
                      rows={2}
                      placeholder="Algum recado especial?"
                    />
                  </div>

                  <div className="rounded-2xl border border-border bg-primary/5 p-4">
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Recebimento</dt>
                        <dd>{RECEIVING_SUMMARY[receiving]}</dd>
                      </div>
                      {receiving === "delivery" && approvedQuote && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Endereço</dt>
                          <dd className="text-right text-xs">{addressLine}</dd>
                        </div>
                      )}
                      {(discount > 0 || receiving === "delivery") && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Subtotal</dt>
                          <dd>{brl(subtotal)}</dd>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <dt>Desconto {PAIR_PROMO_LABEL}</dt>
                          <dd>− {brl(discount)}</dd>
                        </div>
                      )}
                      {receiving === "delivery" && approvedQuote && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Taxa de entrega</dt>
                            <dd>{brl(deliveryFee)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Tempo médio</dt>
                            <dd>{delivery.etaMin} minutos</dd>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                        <dt>Total</dt>
                        <dd className="font-display text-lg text-primary">{brl(total)}</dd>
                      </div>
                    </dl>
                  </div>

                  {subtotal < MIN_ORDER && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                      ⚠️ Pedido mínimo de {brl(MIN_ORDER)}. Faltam{" "}
                      <strong>{brl(MIN_ORDER - subtotal)}</strong> para liberar o pedido.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-border bg-card p-5">
              {step < 3 ? (
                <Button
                  onClick={goNext}
                  disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                  size="lg"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
                >
                  Continuar
                </Button>
              ) : (
                <>
                  {!storeStatus.open && (
                    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                      ⚠️ Estamos fechados agora. Seu pedido será confirmado quando abrirmos ({storeStatus.opensAt}).
                    </div>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={!step1Valid || !step2Valid || submitting || subtotal < MIN_ORDER}
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
                  >
                    {submitting ? "Confirmando..." : "Confirmar pedido"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
