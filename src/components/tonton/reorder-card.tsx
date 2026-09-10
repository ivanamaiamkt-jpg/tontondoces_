import { useEffect, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { useOrder, type CartItem } from "@/contexts/order-context";
import { brl } from "@/lib/format";
import { toast } from "sonner";

const STORAGE_KEY = "tonton_ultimo_pedido";
const DISMISS_KEY = "tonton_ultimo_pedido_dispensado";

type LastOrder = {
  items: CartItem[];
  total: number;
  savedAt: number;
};

export function ReorderCard() {
  const { addItem, setCartOpen, ensureCustomer } = useOrder();
  const [last, setLast] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as LastOrder;
      if (data?.items?.length) setLast(data);
    } catch {
      // ignore
    }
  }, []);

  if (!last) return null;

  const totalQty = last.items.reduce((s, it) => s + it.quantity, 0);
  const main = last.items[0];
  const extra = totalQty - main.quantity;

  const handleReorder = () => {
    const run = () => {
      last.items.forEach((it) => {
        for (let i = 0; i < it.quantity; i++) {
          addItem({
            productId: it.productId,
            productName: it.productName,
            unitPrice: it.unitPrice,
            flavorLabels: it.flavorLabels,
            eventDate: it.eventDate,
            eventLabel: it.eventLabel,
            needsConfirmation: it.needsConfirmation,
          });
        }
      });
      toast.success("Itens adicionados ao carrinho 💜");
      setCartOpen(true);
    };
    ensureCustomer(run);
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setLast(null);
  };

  return (
    <div className="mx-auto mt-4 max-w-5xl px-4">
      <div
        className="relative flex items-center gap-3 rounded-xl border bg-white p-3 sm:p-4"
        style={{ borderColor: "rgba(92,31,92,0.25)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-primary/70">
            🔄 Seu último pedido
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {main.productName}
            {extra > 0 ? ` e mais ${extra} ${extra === 1 ? "item" : "itens"}` : ""} —{" "}
            <strong>{brl(last.total)}</strong>
          </p>
        </div>
        <button
          onClick={handleReorder}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-glow sm:text-sm"
        >
          Pedir de novo
        </button>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
