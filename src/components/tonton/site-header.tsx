import { useEffect, useState } from "react";
import { Clock, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getStoreStatus } from "@/lib/store-hours";

export function SiteHeader() {
  const [status, setStatus] = useState(() => getStoreStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(getStoreStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-black/20 backdrop-blur" style={{ backgroundColor: "#5c1f5c" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="block">
          <p className="font-display text-[10px] uppercase tracking-[0.25em] sm:text-xs" style={{ color: "#c8962a" }}>
            Doceria Artesanal
          </p>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            TonTon Doces
          </h1>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              status.open ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {status.open ? "Aberto" : "Fechado"}
          </span>
          <span
            className="hidden items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-medium sm:inline-flex"
            style={{ color: "#f5e6c8" }}
          >
            <Clock className="h-3 w-3" style={{ color: "#f5e6c8" }} />
            {status.open ? `Fecha às ${status.closesAt}` : `Abre ${status.opensAt}`}
          </span>
          <Link
            to="/meus-pedidos"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-medium hover:bg-white/10"
            style={{ color: "#f5e6c8" }}
          >
            <User className="h-3 w-3" style={{ color: "#f5e6c8" }} />
            <span className="hidden sm:inline">Meus pedidos</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
