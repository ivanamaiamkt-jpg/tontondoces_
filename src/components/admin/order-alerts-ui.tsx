import { Link } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { brl } from "@/lib/format";
import type { useOrderAlerts } from "@/lib/order-alerts";

type Alerts = ReturnType<typeof useOrderAlerts>;

/** Faixa fixa no topo enquanto houver pedido novo que ninguém viu. */
export function OrderAlertBanner({ alerts }: { alerts: Alerts }) {
  const pendingCount = alerts.pending.length;
  if (pendingCount === 0 || !alerts.enabled) return null;
  const first = alerts.pending[0];
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-green-700 px-4 py-3 text-white shadow-2xl"
    >
      <p className="text-sm font-semibold sm:text-base">
        🔔{" "}
        {pendingCount === 1
          ? `Novo pedido de ${first.customer_name} — ${brl(Number(first.total))}`
          : `${pendingCount} pedidos novos — o último é de ${first.customer_name}`}
      </p>
      <div className="flex items-center gap-2">
        <Link
          to="/admin/pedidos"
          onClick={alerts.acknowledge}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-50"
        >
          Ver pedidos
        </Link>
        <button
          onClick={alerts.acknowledge}
          className="rounded-full border border-white/60 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          Silenciar
        </button>
        {alerts.soundBlocked && (
          <button
            onClick={() => void alerts.enableAlerts()}
            className="rounded-full border border-white/60 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Ativar som
          </button>
        )}
      </div>
    </div>
  );
}

/** Caixa na barra lateral: estado do aviso e botões de ativar/desligar. */
export function OrderAlertPanel({ alerts }: { alerts: Alerts }) {
  const needsEnable =
    !alerts.enabled || alerts.soundBlocked || alerts.notifPermission === "default";
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        {alerts.enabled ? (
          <Bell className="h-3.5 w-3.5 text-green-700" />
        ) : (
          <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        Aviso de pedido novo
      </p>
      <p className="mt-1 text-muted-foreground">
        {!alerts.enabled
          ? "Desligado neste aparelho."
          : alerts.soundBlocked
            ? "O som ainda está bloqueado: toque em ativar."
            : "Ligado. Deixe esta aba aberta."}
      </p>
      {alerts.enabled && !alerts.soundBlocked && alerts.notifPermission === "default" && (
        <p className="mt-1 text-muted-foreground">
          Ative também a notificação do navegador pra ver o aviso com a aba escondida.
        </p>
      )}
      {alerts.notifPermission === "denied" && (
        <p className="mt-1 text-muted-foreground">
          A notificação do navegador está bloqueada para este site (só o som e a faixa avisam).
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {needsEnable && (
          <button
            onClick={() => void alerts.enableAlerts()}
            className="rounded-md bg-primary px-2.5 py-1.5 font-semibold text-primary-foreground"
          >
            Ativar alertas
          </button>
        )}
        {alerts.enabled && (
          <button
            onClick={alerts.disableAlerts}
            className="rounded-md border border-border px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-muted"
          >
            Desligar
          </button>
        )}
        <button
          onClick={alerts.toggleKeepAwake}
          aria-pressed={alerts.keepAwake}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${
            alerts.keepAwake
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          Manter tela ligada
        </button>
      </div>
    </div>
  );
}
