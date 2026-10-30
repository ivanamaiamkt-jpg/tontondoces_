import { useEffect, useRef, useState } from "react";
import { useDialogA11y } from "@/lib/use-dialog";
import { Minus, Plus, Trash2, X, ShoppingBag, ArrowLeft, Sparkles, Gift } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckoutSheet } from "./checkout-sheet";
import { SuggestionCarousel, SuggestionFlavorSheet } from "./suggestion-carousel";
import { useGiftMin } from "@/lib/gift";
import { useCartSuggestions } from "@/lib/cart-suggestions";
import { useMinOrder } from "@/lib/min-order";
import { useDeliverySettings } from "@/lib/delivery";
import { PAIR_PROMO_LABEL } from "@/lib/pair-promo";
import { toast } from "sonner";
import { trackPixel } from "@/lib/fbq";

export function CartDrawer() {
  const {
    cartOpen,
    setCartOpen,
    items,
    addItem,
    updateQty,
    removeItem,
    subtotal,
    discount,
    total,
  } = useOrder();
  const MIN_ORDER = useMinOrder();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const initiatedRef = useRef(false);

  // InitiateCheckout sai uma vez só, quando toca em "Finalizar pedido"; carrinho vazio zera a trava.
  useEffect(() => {
    if (items.length === 0) initiatedRef.current = false;
  }, [items.length]);

  // Sugestões do dia (rodízio configurado em Admin > Configurações). "via" marca no pedido
  // que o item veio da sugestão, pra ela medir o que vende.
  const suggestions = useCartSuggestions(items.map((i) => i.productId));

  // Produto com sabor: a barra de escolha do sabor abre embaixo do carrossel.
  const [pickingId, setPickingId] = useState<string | null>(null);
  const picking = suggestions.find((x) => x.id === pickingId) ?? null;
  const giftMin = useGiftMin();
  const delivery = useDeliverySettings();
  // Esc fecha o carrinho (com o checkout aberto por cima, o Esc é do checkout).
  const dialogRef = useDialogA11y<HTMLElement>(cartOpen, () => setCartOpen(false));

  const addSuggestion = (id: string, flavor?: { name: string; price?: number }) => {
    const p = suggestions.find((x) => x.id === id);
    if (!p) return;
    if (p.flavors && !flavor) {
      setPickingId(id);
      return;
    }
    setPickingId(null);
    addItem({
      productId: p.id,
      productName: p.name,
      unitPrice: flavor?.price ?? p.price,
      flavorLabels: flavor ? [flavor.name] : [],
      via: "sugestao",
    });
    toast.success(`+ ${p.name} 💜`);
  };

  if (!cartOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-primary/60"
        onClick={() => setCartOpen(false)}
        aria-hidden
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-gold" />
            <h2 id="cart-title" className="font-display text-xl">Seu carrinho</h2>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="rounded-full p-2.5 hover:bg-primary-glow"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-32">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 font-display text-lg text-foreground">
                Seu carrinho está vazio
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adicione um docinho pra começar 💕
              </p>
              <Button
                onClick={() => setCartOpen(false)}
                variant="outline"
                className="mt-6"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Ver cardápio
              </Button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setCartOpen(false)}
                className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Continuar comprando
              </button>

              <ul className="space-y-3">
                {items.map((it) => (
                  <li
                    key={it.lineId}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-display text-base font-semibold">
                          {it.productName}
                        </p>
                        {it.flavorLabels.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {it.flavorLabels.map((l, i) => (
                              <li key={i}>• {l}</li>
                            ))}
                          </ul>
                        )}
                        {it.eventLabel && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-chocolate">
                            📅 {it.eventLabel}
                          </p>
                        )}
                        {it.needsConfirmation && (
                          <p className="mt-1 text-xs font-semibold text-destructive">
                            ⚠️ Sujeito a confirmação
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(it.lineId)}
                        className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label={`Remover ${it.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1">
                        <button
                          onClick={() =>
                            it.quantity <= 1 ? removeItem(it.lineId) : updateQty(it.lineId, it.quantity - 1)
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
                          aria-label={
                            it.quantity <= 1
                              ? `Remover ${it.productName}`
                              : `Diminuir quantidade de ${it.productName}`
                          }
                        >
                          {it.quantity <= 1 ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className="w-7 text-center text-sm font-semibold"
                          aria-live="polite"
                          aria-label={`${it.quantity} ${it.quantity === 1 ? "unidade" : "unidades"}`}
                        >
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(it.lineId, it.quantity + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
                          aria-label={`Aumentar quantidade de ${it.productName}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="font-display text-lg font-bold text-primary">
                        {brl(it.unitPrice * it.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {giftMin > 0 && (
                <div
                  className={`mt-4 rounded-2xl border p-3.5 ${
                    total >= giftMin
                      ? "border-green-300 bg-green-50"
                      : "border-primary/20 bg-primary/5"
                  }`}
                >
                  <p
                    className={`flex items-center gap-2 text-sm font-semibold ${
                      total >= giftMin ? "text-green-800" : "text-primary"
                    }`}
                  >
                    <Gift className="h-4 w-4 shrink-0" />
                    {total >= giftMin
                      ? "Você ganhou um brinde! 🎁"
                      : `Faltam ${brl(giftMin - total)} pra você ganhar um brinde 🎁`}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        total >= giftMin ? "bg-green-600" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, Math.round((total / giftMin) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{brl(subtotal)}</dd>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <dt>Desconto {PAIR_PROMO_LABEL}</dt>
                      <dd>− {brl(discount)}</dd>
                    </div>
                  )}
                </dl>
                {delivery.enabled && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    A taxa de entrega é calculada no próximo passo ({brl(delivery.feePerKm)} por km)
                  </p>
                )}
              </div>

              {subtotal < MIN_ORDER && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                  ⚠️ Pedido mínimo de {brl(MIN_ORDER)}. Faltam{" "}
                  <strong>{brl(MIN_ORDER - subtotal)}</strong> pra liberar o pedido.
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/5 py-4">
                  <p className="flex items-center gap-1.5 px-4 font-display text-sm font-semibold text-chocolate">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Que tal acrescentar?
                  </p>
                  <p className="mt-0.5 px-4 text-xs text-muted-foreground">
                    Deslize pro lado pra ver mais
                  </p>
                  <SuggestionCarousel suggestions={suggestions} onAdd={(id) => addSuggestion(id)} />
                  {picking && (
                    <SuggestionFlavorSheet
                      product={picking}
                      onPick={(f) => addSuggestion(picking.id, f)}
                      onClose={() => setPickingId(null)}
                    />
                  )}
                </div>
              )}

            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background p-4 shadow-[0_-8px_24px_-8px_rgba(61,26,94,0.25)]">
            <Button
              size="lg"
              disabled={subtotal < MIN_ORDER}
              className="w-full justify-between bg-primary text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary-glow"
              onClick={() => {
                if (!initiatedRef.current) {
                  initiatedRef.current = true;
                  trackPixel("InitiateCheckout", {
                    value: total,
                    currency: "BRL",
                    num_items: items.reduce((s, it) => s + it.quantity, 0),
                    contents: items.map((it) => ({ id: it.productId, quantity: it.quantity })),
                    content_type: "product",
                  });
                }
                setCheckoutOpen(true);
              }}
            >
              <span>
                {subtotal < MIN_ORDER
                  ? `Faltam ${brl(MIN_ORDER - subtotal)}`
                  : "Finalizar pedido"}
              </span>
              <span className="font-display text-lg">{brl(total)}</span>
            </Button>
          </div>
        )}
      </aside>

      <CheckoutSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  );
}
