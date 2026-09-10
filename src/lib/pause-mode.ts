// Pausa temporária: fechado hoje (11/05/2026), reabre amanhã 12/05/2026 às 12h BRT.
// 12:00 BRT = 15:00 UTC.
export const PAUSE_UNTIL = new Date("2026-05-12T15:00:00Z");

export function isPaused(now: Date = new Date()): boolean {
  return now.getTime() < PAUSE_UNTIL.getTime();
}

export const PAUSE_BANNER_TEXT =
  "⏰ Hoje estamos fechados. Pode fazer seu pedido normalmente — entregaremos a partir das 12h de amanhã! 💕";

export const PAUSE_WHATSAPP_NOTE =
  "⚠️ Pedido realizado fora do horário — entrega a partir das 12h de amanhã (12/05).";
