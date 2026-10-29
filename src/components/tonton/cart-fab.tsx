import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useOrder } from "@/contexts/order-context";
import { brl } from "@/lib/format";

/** Barra fixa embaixo (onde fica o polegar): só aparece com itens no carrinho e mostra o total. */
export function CartFab() {
  const { items, total, cartOpen, setCartOpen } = useOrder();
  const count = items.reduce((s, it) => s + it.quantity, 0);

  // Dá um "pulinho" no contador quando entra item novo.
  const [bump, setBump] = useState(false);
  const lastCount = useRef(count);
  useEffect(() => {
    if (count > lastCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 300);
      lastCount.current = count;
      return () => clearTimeout(t);
    }
    lastCount.current = count;
  }, [count]);

  if (count === 0) return null;

  return (
    // Com o carrinho aberto a barra some (invisible) mas continua no lugar: o foco volta pra ela ao fechar.
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pt-2 ${cartOpen ? "invisible" : ""}`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <button
        onClick={() => setCartOpen(true)}
        className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-full bg-primary px-5 text-primary-foreground shadow-[0_8px_24px_-6px_rgba(61,26,94,0.55)] transition-transform active:scale-[0.98]"
        aria-label={`Ver carrinho: ${count} ${count === 1 ? "item" : "itens"}, total ${brl(total)}`}
      >
        <span className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="relative">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <span
              aria-hidden
              className={`absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-primary transition-transform duration-200 ${
                bump ? "scale-125" : "scale-100"
              }`}
            >
              {count}
            </span>
          </span>
          Ver carrinho
        </span>
        <span className="font-display text-lg font-bold">{brl(total)}</span>
      </button>
    </div>
  );
}
