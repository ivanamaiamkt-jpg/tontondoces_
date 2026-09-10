import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X, ShoppingBag, ArrowLeft, Sparkles } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckoutSheet } from "./checkout-sheet";
import { getSuggestionProducts } from "@/lib/menu-data";
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
    deliveryFee,
    total,
    delivery,
  } = useOrder();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (cartOpen && items.length > 0 && !initiatedRef.current) {
      initiatedRef.current = true;
      trackPixel("InitiateCheckout", {
        value: subtotal,
        currency: "BRL",
        num_items: items.reduce((s, it) => s + it.quantity, 0),
        contents: items.map((it) => ({ id: it.productId, quantity: it.quantity })),
        content_type: "product",
      });
    }
  }, [cartOpen, items, subtotal]);

  const inCartIds = new Set(items.map((i) => i.productId));
  const suggestions = getSuggestionProducts()
    .filter((p) => !inCartIds.has(p.id))
    .slice(0, 3);

  const addSuggestion = (id: string) => {
    const p = getSuggestionProducts().find((x) => x.id === id);
    if (!p) return;
    addItem({
      productId: p.id,
      productName: p.name,
      unitPrice: p.price,
      flavorLabels: [],
    });
    toast.success(`+ ${p.name} 💜`);
  };

  if (!cartOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-primary/60 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
        aria-hidden
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl">Seu carrinho</h2>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="rounded-full p-1 hover:bg-primary-glow"
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
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-chocolate">
                            📅 {it.eventLabel}
                          </p>
                        )}
                        {it.needsConfirmation && (
                          <p className="mt-1 text-[10px] font-semibold text-destructive">
                            ⚠️ Sujeito a confirmação
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(it.lineId)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1">
                        <button
                          onClick={() => updateQty(it.lineId, it.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(it.lineId, it.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="font-display text-lg font-bold text-primary">
                        {brl(it.unitPrice * it.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {suggestions.length > 0 && (
                <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-4">
                  <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-chocolate">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Que tal acrescentar?
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Sugestões pequenas pra deixar o pedido ainda mais doce
                  </p>
                  <ul className="mt-3 space-y-2">
                    {suggestions.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-card p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {s.name}
                          </p>
                          <p className="text-xs font-bold text-primary">
                            + {brl(s.price)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addSuggestion(s.id)}
                          className="shrink-0 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{brl(subtotal)}</dd>
                  </div>
                  {delivery?.mode === "delivery" && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Taxa de entrega</dt>
                      <dd>{brl(deliveryFee)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 shadow-[0_-8px_24px_-8px_rgba(61,26,94,0.25)] backdrop-blur">
            <Button
              size="lg"
              className="w-full justify-between bg-primary text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary-glow"
              onClick={() => {
                trackPixel("InitiateCheckout", {
                  value: total,
                  currency: "BRL",
                  num_items: items.reduce((s, it) => s + it.quantity, 0),
                  contents: items.map((it) => ({ id: it.productId, quantity: it.quantity })),
                  content_type: "product",
                });
                setCheckoutOpen(true);
              }}
            >
              <span>Finalizar pedido</span>
              <span className="font-display text-lg">{brl(total)}</span>
            </Button>
          </div>
        )}
      </aside>

      <CheckoutSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  );
}
