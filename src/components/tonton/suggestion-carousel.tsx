import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/menu-data";

/**
 * Carrossel das sugestões do carrinho: cartões compactos que se arrastam com o dedo e têm
 * setinhas nas pontas (a da esquerda só aparece depois de rolar; a da direita some no fim).
 */
export function SuggestionCarousel({
  suggestions,
  onAdd,
}: {
  suggestions: Product[];
  onAdd: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, suggestions.length]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const arrowCls =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md transition hover:bg-primary hover:text-primary-foreground active:scale-95";

  return (
    <div className="relative">
      <ul
        ref={listRef}
        onScroll={update}
        className="mt-3 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {suggestions.map((s) => {
          const promo = s.originalPrice && s.originalPrice > s.price;
          const flavorPrices = (s.flavors ?? []).map((f) => f.price ?? s.price);
          const fromPrice = flavorPrices.length ? Math.min(...flavorPrices) : s.price;
          const varies = flavorPrices.some((v) => v !== fromPrice);
          return (
            <li
              key={s.id}
              className="flex w-[17rem] shrink-0 snap-start gap-2.5 rounded-xl border border-border bg-card p-2.5"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {s.image && (
                  <img
                    src={s.image}
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                {(promo || s.badge) && (
                  <span className="mb-0.5 w-fit rounded-full bg-gold/20 px-1.5 py-px text-xs font-bold uppercase tracking-wider text-primary">
                    {s.badge ?? "Promoção"}
                  </span>
                )}
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                  {s.name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {s.description}
                </p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
                  <div className="leading-none">
                    {promo && (
                      <p className="text-xs text-muted-foreground line-through">
                        {brl(s.originalPrice!)}
                      </p>
                    )}
                    {varies && (
                      <p className="text-xs text-muted-foreground">a partir de</p>
                    )}
                    <p className="text-sm font-bold text-primary">{brl(fromPrice)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAdd(s.id)}
                    aria-label={s.flavors ? `Escolher sabor de ${s.name}` : `Adicionar ${s.name}`}
                    className="h-8 w-8 shrink-0 rounded-full bg-primary p-0 text-primary-foreground hover:bg-primary-glow"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {canLeft && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Ver sugestões anteriores"
          className={`${arrowCls} left-1`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Ver mais sugestões"
          className={`${arrowCls} right-1`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Barra de sabor das sugestões: lista os sabores do produto; tocar num sabor já adiciona ao carrinho. */
export function SuggestionFlavorSheet({
  product,
  onPick,
  onClose,
}: {
  product: Product;
  onPick: (flavor: { name: string; price?: number }) => void;
  onClose: () => void;
}) {
  return (
    <div className="mx-4 mt-3 rounded-xl border-2 border-primary/30 bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Escolha o sabor
          </p>
          <p className="truncate text-xs text-muted-foreground">{product.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar escolha de sabor"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {(product.flavors ?? []).map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onPick({ name: f.name, price: f.price })}
              className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition hover:border-primary/50"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{f.name}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                  {f.description}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-primary">
                {brl(f.price ?? product.price)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
