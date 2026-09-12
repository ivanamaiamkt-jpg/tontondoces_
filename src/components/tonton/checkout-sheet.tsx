import { useEffect, useRef, useState } from "react";
import { X, Check, Heart, Copy, MessageCircle, Loader2, ArrowLeft } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { OWNER_WHATSAPP } from "@/lib/menu-data";
import { brl, maskPhone, maskCep } from "@/lib/format";
import { quoteDelivery, STORE_ADDRESS, STORE_NEIGHBORHOOD, MAX_DELIVERY_KM } from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackPixel } from "@/lib/fbq";
import { syncAbandonedCart, markCartConverted, markCartOutOfArea } from "@/lib/abandoned-cart";
import { getStoreStatus } from "@/lib/store-hours";
import { isPaused, PAUSE_WHATSAPP_NOTE } from "@/lib/pause-mode";

const PIX_KEY = "diretorios.tonton@gmail.com";
const MIN_ORDER = 25;

type FeeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; fee: number; distanceKm: number | null }
  | { kind: "out"; distanceKm: number }
  | { kind: "error" };

const STEP_LABELS = ["Quem é você?", "Para onde entregamos?", "Confirmar pedido"];

export function CheckoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    items,
    delivery,
    subtotal,
    clearCart,
    setCartOpen,
    setDelivery,
    customer,
  } = useOrder();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ? maskPhone(customer.phone) : "");
  const [cep, setCep] = useState(delivery?.cep ?? "");
  const [street, setStreet] = useState(delivery?.street ?? "");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState(delivery?.neighborhood ?? "");
  const [city, setCity] = useState(delivery?.city ?? "");
  const [state, setState] = useState(delivery?.state ?? "");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [fee, setFee] = useState<FeeState>(
    delivery?.fee != null
      ? { kind: "ok", fee: delivery.fee, distanceKm: null }
      : { kind: "idle" },
  );
  const [payment, setPayment] = useState<"pix" | "maquininha">("pix");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedOutOfArea, setAcceptedOutOfArea] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    orderId: string;
    payment: "pix" | "maquininha";
    total: number;
    name: string;
    summary: string;
    outOfArea: boolean;
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

  const lookupSeq = useRef(0);

  const runLookup = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const seq = ++lookupSeq.current;
    setCepLoading(true);
    setCepError(null);
    setFee({ kind: "idle" });
    setAcceptedOutOfArea(false);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (seq !== lookupSeq.current) return;
      if (data.erro) {
        setCepError("CEP não encontrado. Confere o número?");
        setCepLoading(false);
        return;
      }
      const st = data.logradouro ?? "";
      const nb = data.bairro ?? "";
      const ct = data.localidade ?? "";
      const uf = data.uf ?? "";
      setStreet(st);
      setNeighborhood(nb);
      setCity(ct);
      setState(uf);
      setCepLoading(false);

      setFee({ kind: "loading" });
      const cityNorm = ct
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      if (cityNorm && cityNorm !== "sorocaba") {
        if (seq !== lookupSeq.current) return;
        setFee({ kind: "out", distanceKm: 0 });
        setDelivery({
          mode: "delivery",
          cep: rawCep,
          street: st,
          neighborhood: nb,
          city: ct,
          state: uf,
          fee: null,
        });
        return;
      }
      const r = await quoteDelivery({ street: st, neighborhood: nb, cep: rawCep });
      if (seq !== lookupSeq.current) return;
      if (r.ok) {
        setFee({ kind: "ok", fee: r.fee, distanceKm: r.distanceKm });
        setDelivery({
          mode: "delivery",
          cep: rawCep,
          street: st,
          neighborhood: nb,
          city: ct,
          state: uf,
          fee: r.fee,
        });
      } else if (r.reason === "out_of_area") {
        setFee({ kind: "out", distanceKm: r.distanceKm });
        setDelivery({
          mode: "delivery",
          cep: rawCep,
          street: st,
          neighborhood: nb,
          city: ct,
          state: uf,
          fee: null,
        });
      } else {
        setFee({ kind: "error" });
        setDelivery({
          mode: "delivery",
          cep: rawCep,
          street: st,
          neighborhood: nb,
          city: ct,
          state: uf,
          fee: null,
        });
      }
    } catch {
      if (seq !== lookupSeq.current) return;
      setCepError("Não consegui consultar o CEP. Tenta de novo?");
      setCepLoading(false);
    }
  };

  const handleCepChange = (v: string) => {
    const masked = maskCep(v);
    setCep(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) {
      void runLookup(masked);
    } else {
      setCepError(null);
      setFee({ kind: "idle" });
      setAcceptedOutOfArea(false);
    }
  };

  if (!open) return null;

  const cepValid = cep.replace(/\D/g, "").length === 8 && !cepError;
  const phoneDigits = phone.replace(/\D/g, "");
  const step1Valid = name.trim().length >= 2 && phoneDigits.length >= 10;
  const outOfArea = fee.kind === "out";
  const step2Valid =
    cepValid && number.trim().length > 0 && (fee.kind === "ok" || (outOfArea && acceptedOutOfArea));

  const effectiveFee = fee.kind === "ok" ? fee.fee : 0;
  const total = subtotal + effectiveFee;

  const cancelOutOfAreaCart = () => {
    void markCartOutOfArea();
    clearCart();
    onClose();
  };

  const handleSubmit = async () => {
    if (!step1Valid || !step2Valid || submitting) return;
    setSubmitting(true);
    const orderId = `TT-${Date.now().toString().slice(-6)}`;
    const outOfAreaNote = "Cliente vai buscar via Uber/moto própria (fora da área de entrega).";

    try {
      await supabase.from("orders" as never).insert({
        order_number: orderId,
        customer_id: customer?.id ?? null,
        customer_name: name,
        customer_phone: phoneDigits,
        delivery_mode: "delivery",
        street,
        number,
        complement: complement || null,
        neighborhood,
        city: city || null,
        items: items as unknown as object,
        subtotal,
        delivery_fee: effectiveFee,
        total,
        payment_method: payment,
        notes: outOfArea ? `${outOfAreaNote}${notes ? " " + notes : ""}` : notes || null,
        status: "novo",
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
    lines.push(`*Subtotal:* ${brl(subtotal)}`);
    lines.push(
      `*Taxa de entrega:* ${outOfArea ? "Cliente busca (fora da área)" : brl(effectiveFee)}`,
    );
    lines.push(
      `*Endereço:* ${street}, ${number}${complement ? ` — ${complement}` : ""} — ${neighborhood} — ${city} — CEP ${cep}`,
    );
    lines.push(`*Total:* ${brl(total)}`);
    lines.push("");
    lines.push(
      `*Pagamento:* ${payment === "pix" ? "PIX (chave enviada após confirmação)" : "Cartão (débito ou crédito na entrega)"}`,
    );
    if (outOfArea) lines.push(`*Observação:* ${outOfAreaNote}`);
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

    setConfirmed({ orderId, payment, total, name, summary, outOfArea });
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
              <strong>{confirmed.payment === "pix" ? "PIX" : "Cartão na entrega"}</strong>
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
                💳 Pagamento na entrega — débito ou crédito na maquininha.
              </div>
            )}

            {confirmed.outOfArea && (
              <div className="mt-5 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left">
                <p className="font-display text-sm font-semibold text-primary">
                  🚗 Endereço da loja (pra chamar seu Uber/moto)
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <code className="flex-1 text-sm font-medium text-foreground">
                    {STORE_ADDRESS}
                  </code>
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
                  Cola esse endereço no app de corrida da sua preferência pra buscar seu pedido 💕
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
                <>
                  <div>
                    <Label>CEP *</Label>
                    <Input
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      className="mt-1"
                      placeholder="00000-000"
                      inputMode="numeric"
                      maxLength={9}
                    />
                    {cepLoading && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Consultando CEP...
                      </p>
                    )}
                    {cepError && (
                      <p className="mt-1.5 text-xs text-destructive">{cepError}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Rua</Label>
                      <Input
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Número *</Label>
                      <Input
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        className="mt-1"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Complemento</Label>
                    <Input
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="mt-1"
                      placeholder="apto, bloco, referência"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {fee.kind === "loading" && (
                    <p className="inline-flex items-center gap-1.5 rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 📍 Calculando taxa...
                    </p>
                  )}
                  {fee.kind === "ok" && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      {fee.fee === 0
                        ? "✓ Entrega Grátis 🎉"
                        : fee.distanceKm != null
                          ? `✓ ${fee.distanceKm.toFixed(1).replace(".", ",")}km · Taxa: ${brl(fee.fee)}`
                          : `✓ Taxa: ${brl(fee.fee)}`}
                    </p>
                  )}
                  {fee.kind === "out" && !acceptedOutOfArea && (
                    <div className="space-y-3 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                      <p>
                        ⚠️ Fora da área de atendimento — só entregamos até {MAX_DELIVERY_KM}km da
                        loja, que fica no bairro <strong>{STORE_NEIGHBORHOOD}</strong>.
                      </p>
                      <p className="text-xs">
                        Você ainda pode fazer o pedido e buscar com seu próprio Uber/moto — no
                        próximo passo a gente te dá o endereço certinho pra copiar.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAcceptedOutOfArea(true)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-glow"
                        >
                          Quero seguir mesmo assim
                        </button>
                        <button
                          type="button"
                          onClick={cancelOutOfAreaCart}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Cancelar carrinho
                        </button>
                      </div>
                      <a
                        href={`https://wa.me/${OWNER_WHATSAPP}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
                      </a>
                    </div>
                  )}
                  {fee.kind === "out" && acceptedOutOfArea && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      ✓ Combinado! Você vai buscar seu pedido — o endereço da loja aparece no
                      próximo passo.
                    </p>
                  )}
                  {fee.kind === "error" && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Não consegui calcular agora — tenta novamente.
                    </p>
                  )}
                </>
              )}

              {step === 3 && (
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
                          payment === "pix"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="font-semibold text-foreground">💸 PIX</div>
                        <div className="text-xs text-muted-foreground">
                          Chave enviada após confirmação do pedido
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayment("maquininha")}
                        className={`rounded-xl border-2 p-3 text-left text-sm transition ${
                          payment === "maquininha"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="font-semibold text-foreground">💳 Cartão</div>
                        <div className="text-xs text-muted-foreground">
                          Débito ou crédito na entrega
                        </div>
                      </button>
                    </div>
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
                        <dt className="text-muted-foreground">Subtotal</dt>
                        <dd>{brl(subtotal)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Taxa de entrega</dt>
                        <dd>
                          {outOfArea
                            ? "Você busca (Uber)"
                            : effectiveFee === 0
                              ? "Grátis"
                              : brl(effectiveFee)}
                        </dd>
                      </div>
                      {outOfArea && (
                        <p className="text-xs text-muted-foreground">
                          Fora da área de entrega — o endereço da loja pra você copiar aparece
                          depois de confirmar.
                        </p>
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
