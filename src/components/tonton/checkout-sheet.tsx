import { useEffect, useState } from "react";
import { X, Check, Heart, Copy, MessageCircle, ArrowLeft, Store, Car } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { OWNER_WHATSAPP, MIN_ORDER, STORE_ADDRESS } from "@/lib/menu-data";
import { brl, maskPhone } from "@/lib/format";
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

type Receiving = "pickup" | "uber";

const STEP_LABELS = ["Quem é você?", "Como você quer receber?", "Confirmar pedido"];

const RECEIVING_WHATSAPP: Record<Receiving, string> = {
  pickup: "Retirada na loja",
  uber: "Uber (cliente chama quando avisarmos)",
};

const RECEIVING_SUMMARY: Record<Receiving, string> = {
  pickup: "Retirada na loja",
  uber: "Uber (você chama)",
};

export function CheckoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, total, clearCart, setCartOpen, customer } = useOrder();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ? maskPhone(customer.phone) : "");
  const [receiving, setReceiving] = useState<Receiving | null>(null);
  const [payment, setPayment] = useState<"pix" | "maquininha">("pix");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    orderId: string;
    payment: "pix" | "maquininha";
    total: number;
    name: string;
    summary: string;
    receiving: Receiving;
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

  if (!open) return null;

  const phoneDigits = phone.replace(/\D/g, "");
  const step1Valid = name.trim().length >= 2 && phoneDigits.length >= 10;
  const step2Valid = receiving !== null;
  // Com Uber o pagamento é sempre PIX adiantado (o motorista não leva maquininha).
  const effectivePayment: "pix" | "maquininha" = receiving === "uber" ? "pix" : payment;

  const chooseReceiving = (r: Receiving) => {
    setReceiving(r);
    if (r === "uber") setPayment("pix");
  };

  const handleSubmit = async () => {
    if (!step1Valid || !receiving || submitting || subtotal < MIN_ORDER) return;
    setSubmitting(true);
    const orderId = `TT-${Date.now().toString().slice(-6)}`;

    try {
      await supabase.from("orders" as never).insert({
        order_number: orderId,
        customer_id: customer?.id ?? null,
        customer_name: name,
        customer_phone: phoneDigits,
        delivery_mode: receiving,
        items: items as unknown as object,
        subtotal,
        delivery_fee: 0,
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
    lines.push(`*Recebimento:* ${RECEIVING_WHATSAPP[receiving]}`);
    lines.push(`*Total:* ${brl(total)}`);
    lines.push("");
    lines.push(
      `*Pagamento:* ${effectivePayment === "pix" ? "PIX (chave enviada após confirmação)" : "Cartão (débito ou crédito na retirada)"}`,
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

    setConfirmed({ orderId, payment: effectivePayment, total, name, summary, receiving });
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
              <strong>{confirmed.payment === "pix" ? "PIX" : "Cartão na retirada"}</strong>
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
                💳 Pagamento na retirada — débito ou crédito na maquininha.
              </div>
            )}

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
                      {receiving === "pickup" && (
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
                            Débito ou crédito na retirada
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
