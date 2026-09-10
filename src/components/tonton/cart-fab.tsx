import { ShoppingBag } from "lucide-react";
import { useOrder } from "@/contexts/order-context";

export function CartFab() {
  const { items, setCartOpen } = useOrder();
  const count = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <button
      onClick={() => setCartOpen(true)}
      className="fixed z-50 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-white shadow-lg active:scale-95"
      style={{ top: 12, right: 16, backgroundColor: "#5c1f5c" }}
      aria-label={`Abrir carrinho com ${count} ${count === 1 ? "item" : "itens"}`}
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Carrinho</span>
      {count > 0 && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-gold-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
