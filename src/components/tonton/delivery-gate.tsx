import { useState } from "react";
import { Loader2, MapPin, MessageCircle, Calculator } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { OWNER_WHATSAPP } from "@/lib/menu-data";
import { quoteDelivery, STORE_NEIGHBORHOOD, MAX_DELIVERY_KM } from "@/lib/delivery";
import { brl, maskCep } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ViaCepResp = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; fee: number; distanceKm: number | null }
  | { kind: "out"; distanceKm: number }
  | { kind: "error" };

export function DeliveryGate({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { setDelivery } = useOrder();
  const [step] = useState<"cep">("cep");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepInfo, setCepInfo] = useState<ViaCepResp | null>(null);
  const [cepError, setCepError] = useState<string | null>(null);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [quote, setQuote] = useState<QuoteState>({ kind: "idle" });

  if (!open) return null;

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    setCepInfo(null);
    setQuote({ kind: "idle" });
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCepResp = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado. Confere o número?");
      } else {
        setCepInfo(data);
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setState(data.uf ?? "");
      }
    } catch {
      setCepError("Não consegui consultar o CEP agora. Tenta de novo?");
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (v: string) => {
    const masked = maskCep(v);
    setCep(masked);
    if (masked.replace(/\D/g, "").length === 8) {
      void lookupCep(masked);
    } else {
      setCepInfo(null);
      setCepError(null);
      setQuote({ kind: "idle" });
    }
  };

  const calcular = async () => {
    setQuote({ kind: "loading" });
    // Se a cidade do CEP não for Sorocaba, já marca como fora da área.
    const cityNorm = (cepInfo?.localidade ?? city ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (cityNorm && cityNorm !== "sorocaba") {
      setQuote({ kind: "out", distanceKm: 0 });
      return;
    }
    const r = await quoteDelivery({ street, number, neighborhood, cep });
    if (r.ok) setQuote({ kind: "ok", fee: r.fee, distanceKm: r.distanceKm });
    else if (r.reason === "out_of_area")
      setQuote({ kind: "out", distanceKm: r.distanceKm });
    else setQuote({ kind: "error" });
  };

  const confirmDelivery = () => {
    if (quote.kind !== "ok") return;
    setDelivery({
      mode: "delivery",
      cep,
      street,
      neighborhood,
      city,
      state,
      fee: quote.fee,
    });
    onClose();
  };


  const whatsappLink = () => {
    const msg = encodeURIComponent(
      `Oi TonTon! 🍫 Meu CEP é ${cep}${neighborhood ? ` (${neighborhood})` : ""}${
        street && number ? `, ${street}, ${number}` : ""
      }. Pode me ajudar a calcular a taxa de entrega? Obrigada!`,
    );
    return `https://wa.me/${OWNER_WHATSAPP}?text=${msg}`;
  };

  const canCalc = cep.replace(/\D/g, "").length === 8 && number.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-primary/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary-glow/40 text-primary-foreground hover:bg-primary-glow"
        >
          ✕
        </button>
        <div className="bg-primary px-6 py-8 text-center text-primary-foreground">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
            TonTon Doces
          </p>
          <h2 className="mt-2 font-display text-3xl">Para onde a entrega?</h2>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Informe seu CEP para calcularmos a taxa
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === "cep" && (
            <div className="space-y-4">

              <div>
                <Label htmlFor="cep" className="text-sm font-medium">
                  CEP
                </Label>
                <Input
                  id="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className="mt-2 h-12 text-base"
                  autoFocus
                />
              </div>

              {cepLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando CEP...
                </div>
              )}

              {cepError && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {cepError}
                </p>
              )}

              {cepInfo && !cepError && (
                <>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={calcular}
                    disabled={!canCalc || quote.kind === "loading"}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
                    size="lg"
                  >
                    {quote.kind === "loading" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-4 w-4" /> Calcular taxa
                      </>
                    )}
                  </Button>

                  {quote.kind === "ok" && (
                    <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {street}, {number}
                          </p>
                          <p className="text-muted-foreground">
                            {neighborhood} — {city}
                            {state ? `/${state}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {quote.distanceKm != null
                              ? `~${quote.distanceKm.toFixed(1)} km de distância`
                              : "Taxa fixa para este bairro"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="text-sm text-muted-foreground">Taxa de entrega</span>
                        <span className="font-display text-lg font-semibold text-primary">
                          {quote.fee === 0 ? "Grátis" : brl(quote.fee)}
                        </span>
                      </div>
                      <Button
                        onClick={confirmDelivery}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary-glow"
                        size="lg"
                      >
                        Continuar pro cardápio
                      </Button>
                    </div>
                  )}

                  {quote.kind === "out" && (
                    <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      <p className="font-medium text-destructive">
                        ⚠️ Fora da área de entrega (bairro {STORE_NEIGHBORHOOD}, até{" "}
                        {MAX_DELIVERY_KM}km).
                      </p>

                      <a
                        href={whatsappLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white"
                      >
                        <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                      </a>
                    </div>
                  )}

                  {quote.kind === "error" && (
                    <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      <p className="text-foreground">
                        Não conseguimos calcular automaticamente. Entre em contato pelo
                        WhatsApp.
                      </p>
                      <a
                        href={whatsappLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white"
                      >
                        <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
