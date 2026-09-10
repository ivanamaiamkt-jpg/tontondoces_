import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncAbandonedCart } from "@/lib/abandoned-cart";

export type DeliveryMode = "delivery" | "pickup";

export type DeliveryInfo = {
  mode: DeliveryMode;
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  fee?: number | null; // null = sob consulta, undefined = pickup
};

export type CartItem = {
  /** Unique line id (random) so the same product+flavor combos can repeat. */
  lineId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  /** Selected flavor names, joined for display. */
  flavorLabels: string[];
  /** Para itens de festa: data/hora ISO do evento + texto formatado. */
  eventDate?: string;
  eventLabel?: string;
  /** Se true, aviso "sujeito a confirmação" deve ser mostrado. */
  needsConfirmation?: boolean;
};

export type Customer = {
  id?: string; // uuid no banco (preenchido após upsert)
  name: string;
  phone: string; // digits only
};

type AddItemPayload = Omit<CartItem, "lineId" | "quantity"> & { quantity?: number };

type OrderContextValue = {
  delivery: DeliveryInfo | null;
  setDelivery: (d: DeliveryInfo | null) => void;
  items: CartItem[];
  addItem: (item: AddItemPayload) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  customer: Customer | null;
  customerPromptOpen: boolean;
  confirmCustomer: (c: Customer) => void;
  /** If customer not set yet, opens modal and runs `then` after confirm. Returns true if action ran immediately. */
  ensureCustomer: (then: () => void) => boolean;
};

const OrderContext = createContext<OrderContextValue | null>(null);

const STORAGE_DELIVERY = "tonton.delivery";
const STORAGE_CART = "tonton.cart";
const STORAGE_CUSTOMER = "tonton_cliente";

export function OrderProvider({ children }: { children: ReactNode }) {
  const [delivery, setDeliveryState] = useState<DeliveryInfo | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const customerRef = useRef<Customer | null>(null);
  const [customerPromptOpen, setCustomerPromptOpen] = useState(false);
  const pendingItemRef = useRef<AddItemPayload | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    customerRef.current = customer;
  }, [customer]);

  // Hydrate from localStorage (client-only).
  useEffect(() => {
    try {
      const d = localStorage.getItem(STORAGE_DELIVERY);
      const c = localStorage.getItem(STORAGE_CART);
      const cu = localStorage.getItem(STORAGE_CUSTOMER);
      if (d) setDeliveryState(JSON.parse(d));
      if (c) setItems(JSON.parse(c));
      if (cu) setCustomer(JSON.parse(cu));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (delivery) localStorage.setItem(STORAGE_DELIVERY, JSON.stringify(delivery));
    else localStorage.removeItem(STORAGE_DELIVERY);
  }, [delivery]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CART, JSON.stringify(items));
    if (customer && items.length > 0) {
      syncAbandonedCart({ nome: customer.name, telefone: customer.phone, items });
    }
  }, [items, customer]);

  const setDelivery = (d: DeliveryInfo | null) => {
    setDeliveryState(d);
  };

  const pushItem = (item: AddItemPayload) => {
    setItems((prev) => [
      ...prev,
      {
        ...item,
        quantity: item.quantity ?? 1,
        lineId: Math.random().toString(36).slice(2, 10),
      },
    ]);
    // Não abrimos o carrinho automaticamente — cliente continua comprando.
  };

  const addItem: OrderContextValue["addItem"] = (item) => {
    if (!customerRef.current) {
      pendingItemRef.current = item;
      setCustomerPromptOpen(true);
      return;
    }
    pushItem(item);
  };

  const confirmCustomer = async (c: Customer) => {
    // Persiste localmente já (UX rápida) — atualiza ref ANTES de callbacks
    customerRef.current = c;
    setCustomer(c);
    try {
      localStorage.setItem(STORAGE_CUSTOMER, JSON.stringify(c));
    } catch {
      // ignore
    }
    setCustomerPromptOpen(false);

    // Upsert no banco em background — pega/atribui id
    try {
      const cleanPhone = c.phone.replace(/\D/g, "");
      const { data, error } = await (supabase
        .from("customers" as never)
        .upsert(
          { name: c.name, phone: cleanPhone, updated_at: new Date().toISOString() } as never,
          { onConflict: "phone" } as never,
        )
        .select("id")
        .single());
      if (!error && data) {
        const withId = { ...c, id: (data as { id: string }).id };
        setCustomer(withId);
        try {
          localStorage.setItem(STORAGE_CUSTOMER, JSON.stringify(withId));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar cliente:", e);
    }

    const pending = pendingItemRef.current;
    pendingItemRef.current = null;
    if (pending) pushItem(pending);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  };

  const ensureCustomer: OrderContextValue["ensureCustomer"] = (then) => {
    if (customerRef.current) {
      then();
      return true;
    }
    pendingActionRef.current = then;
    setCustomerPromptOpen(true);
    return false;
  };

  const updateQty = (lineId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((it) => (it.lineId === lineId ? { ...it, quantity: Math.max(1, qty) } : it))
        .filter((it) => it.quantity > 0),
    );
  };

  const removeItem = (lineId: string) =>
    setItems((prev) => prev.filter((it) => it.lineId !== lineId));

  const clearCart = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [items],
  );

  const deliveryFee = useMemo(() => {
    if (!delivery || delivery.mode !== "delivery") return 0;
    return delivery.fee ?? 0;
  }, [delivery]);

  const total = subtotal + deliveryFee;

  return (
    <OrderContext.Provider
      value={{
        delivery,
        setDelivery,
        items,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        subtotal,
        deliveryFee,
        total,
        cartOpen,
        setCartOpen,
        customer,
        customerPromptOpen,
        confirmCustomer,
        ensureCustomer,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used inside OrderProvider");
  return ctx;
}
