// Aviso de pedido novo no painel. Roda no layout do admin (vale em qualquer tela do painel):
//  * confere a lista de pedidos "novo" a cada 15 s (e na hora, se o tempo real avisar);
//  * enquanto houver pedido novo que ninguém "viu", toca o som a cada 7 s, pisca o título da aba
//    e mostra uma faixa fixa — só para quando a pessoa toca em "Ver pedidos" ou "Silenciar";
//  * se o navegador deixar, também manda a notificação do sistema (aparece mesmo com a aba escondida).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { installAudioUnlock, isAudioBlocked, playOrderSound, unlockAudio } from "@/lib/admin-sound";

export type NewOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  created_at: string;
};

/** Evento que a tela de Pedidos escuta pra atualizar o quadro na hora. */
export const ORDERS_CHANGED_EVENT = "tonton-orders-changed";

const ACK_KEY = "tonton_admin_pedidos_vistos";
const ENABLED_KEY = "tonton_admin_alertas";
const AWAKE_KEY = "tonton_admin_tela_ligada";
const POLL_MS = 15_000;
const REPEAT_MS = 7_000;

function readAck(): string[] | null {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function writeAck(ids: string[]) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify(ids.slice(-300)));
  } catch {
    // ignore
  }
}

function readFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** `fetchNew` só existe pra testar (devolve os pedidos "novo"); no painel usa o banco. */
export function useOrderAlerts(fetchNew?: () => Promise<NewOrder[] | null>) {
  const [pending, setPending] = useState<NewOrder[]>([]);
  const [enabled, setEnabledState] = useState(true);
  const [keepAwake, setKeepAwakeState] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const notified = useRef<Set<string>>(new Set());
  const announced = useRef<Set<string>>(new Set());
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  // estado salvo neste aparelho
  useEffect(() => {
    setEnabledState(readFlag(ENABLED_KEY, true));
    setKeepAwakeState(readFlag(AWAKE_KEY, false));
    setNotifPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    setSoundBlocked(isAudioBlocked());
    return installAudioUnlock();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSoundBlocked(isAudioBlocked()), 2000);
    return () => clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    let data: NewOrder[] | null;
    if (fetchNew) {
      data = await fetchNew();
    } else {
      const res = (await supabase
        .from("orders" as never)
        .select("id,order_number,customer_name,total,created_at")
        .eq("status", "novo")
        .order("created_at", { ascending: false })
        .limit(30)) as unknown as { data: NewOrder[] | null; error: unknown };
      data = res.error ? null : res.data;
    }
    if (!data) return;

    let ack = readAck();
    if (ack === null) {
      // Primeira vez neste aparelho: o que já está lá não conta como "novo".
      ack = data.map((o) => o.id);
      writeAck(ack);
    }
    const seen = new Set(ack);
    const unseen = data.filter((o) => !seen.has(o.id));
    setPending((prev) => {
      const same = prev.length === unseen.length && prev.every((p, i) => p.id === unseen[i].id);
      return same ? prev : unseen;
    });
    // Pedido que a gente ainda não tinha visto: avisa a tela de Pedidos pra atualizar o quadro já.
    const fresh = unseen.filter((o) => !announced.current.has(o.id));
    if (fresh.length > 0) {
      fresh.forEach((o) => announced.current.add(o.id));
      window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
    }
  }, [fetchNew]);

  // confere agora, a cada 15 s, quando a aba volta a ficar visível e quando o tempo real avisar
  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    const channel = fetchNew
      ? null
      : supabase
          .channel("admin-new-order-alert")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => void poll())
          .subscribe();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [poll, fetchNew]);

  // som repetido + título piscando enquanto houver pedido novo não visto
  const hasPending = pending.length > 0;
  const pendingCount = pending.length;
  useEffect(() => {
    if (!hasPending || !enabled) return;
    playOrderSound();
    const sound = setInterval(playOrderSound, REPEAT_MS);
    const original = document.title;
    let on = false;
    const blink = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 (${pendingCount}) NOVO PEDIDO!` : original;
    }, 1000);
    return () => {
      clearInterval(sound);
      clearInterval(blink);
      document.title = original;
    };
  }, [hasPending, pendingCount, enabled]);

  // notificação do sistema (uma por pedido)
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    for (const o of pending) {
      if (notified.current.has(o.id)) continue;
      notified.current.add(o.id);
      try {
        const n = new Notification(`Novo pedido #${o.order_number}`, {
          body: `${o.customer_name} — R$ ${Number(o.total).toFixed(2).replace(".", ",")}`,
          tag: `tonton-pedido-${o.id}`,
          icon: "/icon-192.png",
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // alguns navegadores (celular) só aceitam notificação por service worker
      }
    }
  }, [pending, enabled]);

  // "Visto": guarda os ids dos pedidos que estão na faixa e limpa o aviso (som, título e faixa param).
  const pendingRef = useRef<NewOrder[]>([]);
  pendingRef.current = pending;
  const acknowledge = useCallback(() => {
    const ack = new Set(readAck() ?? []);
    pendingRef.current.forEach((o) => ack.add(o.id));
    writeAck([...ack]);
    setPending([]);
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as unknown as {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
      };
      if (!nav.wakeLock || wakeLock.current) return;
      wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      wakeLock.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  // tela ligada: o navegador solta o bloqueio quando a aba some; pede de novo ao voltar
  useEffect(() => {
    if (!keepAwake) {
      releaseWakeLock();
      return;
    }
    void requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        wakeLock.current = null;
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      releaseWakeLock();
    };
  }, [keepAwake, requestWakeLock, releaseWakeLock]);

  /** Chamar dentro de um clique: libera o som, pede a notificação e (opcional) mantém a tela ligada. */
  const enableAlerts = useCallback(async () => {
    writeFlag(ENABLED_KEY, true);
    setEnabledState(true);
    await unlockAudio();
    setSoundBlocked(isAudioBlocked());
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        setNotifPermission(await Notification.requestPermission());
      } catch {
        // ignore
      }
    }
    playOrderSound();
  }, []);

  const disableAlerts = useCallback(() => {
    writeFlag(ENABLED_KEY, false);
    setEnabledState(false);
  }, []);

  const toggleKeepAwake = useCallback(() => {
    setKeepAwakeState((v) => {
      writeFlag(AWAKE_KEY, !v);
      return !v;
    });
  }, []);

  return {
    pending,
    acknowledge,
    enabled,
    enableAlerts,
    disableAlerts,
    soundBlocked,
    notifPermission,
    keepAwake,
    toggleKeepAwake,
  };
}
