import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { OWNER_WHATSAPP, MIN_ORDER } from "@/lib/menu-data";
import { getStoreStatus } from "@/lib/store-hours";

export function StoreStatus() {
  const [status, setStatus] = useState(() => getStoreStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(getStoreStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 text-[13px] backdrop-blur-md sm:mt-6">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
          status.open ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        {status.open ? "Aberto" : "Fechado"}
      </span>

      <span className="font-medium text-primary-foreground">
        {status.open ? `Fecha às ${status.closesAt}` : `Abre ${status.opensAt}`}
      </span>

      <span className="hidden h-3 w-px bg-white/20 sm:inline" />

      <span className="font-light text-primary-foreground/85">
        Pedido mínimo: <span className="font-semibold text-gold">R$ {MIN_ORDER},00</span>
      </span>

      <a
        href={`https://wa.me/${OWNER_WHATSAPP}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-600"
      >
        <MessageCircle className="h-3.5 w-3.5 fill-white" />
        WhatsApp
      </a>
    </div>
  );
}
