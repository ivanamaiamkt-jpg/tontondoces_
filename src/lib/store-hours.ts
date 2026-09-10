// Horários de funcionamento da TonTon Doces (fuso America/Sao_Paulo, GMT-3).
// 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
// closeHour 24 representa meia-noite do dia seguinte.
export type DayHours = { open: number; close: number };

export const STORE_HOURS: Record<number, DayHours> = {
  0: { open: 11, close: 20 }, // domingo
  1: { open: 12, close: 22 }, // segunda
  2: { open: 12, close: 22 },
  3: { open: 12, close: 22 },
  4: { open: 12, close: 22 },
  5: { open: 12, close: 24 }, // sexta
  6: { open: 12, close: 24 }, // sábado
};

const DAY_NAMES = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/** Retorna {dayOfWeek, hour, minute} no fuso de Brasília (GMT-3). */
function brNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { day: map[wd] ?? 0, hour: hour === 24 ? 0 : hour, minute };
}

function fmtHour(h: number) {
  const hh = h === 24 ? 0 : h;
  return `${hh.toString().padStart(2, "0")}:00`;
}

export type StoreStatus = {
  open: boolean;
  /** Horário de fechamento de hoje (ex. "22:00" ou "00:00"). */
  closesAt: string;
  /** Próxima abertura (ex. "amanhã às 12:00" ou "segunda às 12:00"). */
  opensAt: string;
  /** Texto resumido pronto pra exibir. */
  label: string;
};

import { isPaused, PAUSE_UNTIL } from "./pause-mode";

export function getStoreStatus(now: Date = new Date()): StoreStatus {
  if (isPaused(now)) {
    const reopen = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(PAUSE_UNTIL);
    return {
      open: false,
      closesAt: "",
      opensAt: `amanhã às ${reopen}`,
      label: `🔴 Fechado · Abre amanhã às ${reopen}`,
    };
  }
  const { day, hour, minute } = brNow(now);
  const today = STORE_HOURS[day];
  const minutesNow = hour * 60 + minute;
  const openMin = today.open * 60;
  const closeMin = today.close * 60; // 24*60 = 1440 (meia-noite)

  const isOpen = minutesNow >= openMin && minutesNow < closeMin;
  const closesAt = fmtHour(today.close);

  let opensAt = "";
  if (!isOpen) {
    if (minutesNow < openMin) {
      // ainda vai abrir hoje
      opensAt = `hoje às ${fmtHour(today.open)}`;
    } else {
      // já fechou hoje → procurar próximo dia
      const nextDay = (day + 1) % 7;
      const next = STORE_HOURS[nextDay];
      const dayLabel = nextDay === (day + 1) % 7 ? "amanhã" : DAY_NAMES[nextDay];
      opensAt = `${dayLabel} às ${fmtHour(next.open)}`;
      // dayLabel sempre será "amanhã" aqui, mas mantemos a estrutura
      void DAY_NAMES;
    }
  }

  const label = isOpen
    ? `🟢 Aberto agora · Fecha às ${closesAt}`
    : `🔴 Fechado · Abre ${opensAt}`;

  return { open: isOpen, closesAt, opensAt, label };
}
