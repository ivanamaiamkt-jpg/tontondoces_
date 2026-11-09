import { useEffect, useState } from "react";
import { isPaused, PAUSE_BANNER_TEXT, PAUSE_UNTIL } from "@/lib/pause-mode";
import { useStoreStatus } from "@/lib/store-open";

/** Faixa no topo: pausa programada ou loja fechada à mão (com a mensagem escrita em Configurações). */
export function PauseBanner() {
  const store = useStoreStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const update = () => setShow(isPaused());
    update();
    const ms = PAUSE_UNTIL.getTime() - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(update, Math.min(ms + 100, 60_000));
    const interval = setInterval(update, 60_000);
    return () => {
      clearTimeout(id);
      clearInterval(interval);
    };
  }, []);

  const text = store.manual && store.message ? store.message : show ? PAUSE_BANNER_TEXT : null;
  if (!text) return null;

  return (
    <div
      role="status"
      style={{
        backgroundColor: "#c8962a",
        color: "#5c1f5c",
        textAlign: "center",
        padding: "10px 16px",
        fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
        fontSize: "13px",
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {text}
    </div>
  );
}
