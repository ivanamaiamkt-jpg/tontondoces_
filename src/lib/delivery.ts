// Taxa de entrega, em ordem de prioridade:
//   1. Tabela delivery_fees (Admin > Taxas) — override manual, sempre vence.
//   2. Lista BAIRROS_7KM (varredura pré-calculada do OpenStreetMap) — cobre a
//      grande maioria dos bairros reais de Sorocaba sem depender de rede.
//   3. Nominatim + Haversine ao vivo — só pra endereços fora das duas acima.
// Atendemos só até 7km da loja (Rua Pedro Lombardi, 890 — Vila Mineirão).
import { supabase } from "@/integrations/supabase/client";
import { BAIRROS_7KM } from "@/lib/sorocaba-bairros";

const ORIGIN = { lat: -23.46732700953204, lon: -47.4625592865066 };
export const MAX_DELIVERY_KM = 7;
export const STORE_ADDRESS = "Rua Pedro Lombardi, 890 - Vila Mineirão, Sorocaba - SP, 18076-520";
export const STORE_NEIGHBORHOOD = "Vila Mineirão";

type NominatimResult = { lat: string; lon: string };

function normalizeNeighborhood(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function getFeeFromSweep(neighborhood: string): { fee: number; km: number } | null {
  const target = normalizeNeighborhood(neighborhood);
  if (!target) return null;
  const match = BAIRROS_7KM.find((b) => normalizeNeighborhood(b.name) === target);
  return match ? { fee: match.fee, km: match.km } : null;
}

async function getFeeByNeighborhood(neighborhood: string): Promise<number | null> {
  const target = normalizeNeighborhood(neighborhood);
  if (!target) return null;
  const { data, error } = (await supabase
    .from("delivery_fees" as never)
    .select("neighborhood, fee")
    .eq("is_active", true)) as unknown as {
    data: { neighborhood: string; fee: number }[] | null;
    error: unknown;
  };
  if (error || !data) return null;
  const match = data.find((row) => normalizeNeighborhood(row.neighborhood) === target);
  return match ? Number(match.fee) : null;
}

async function nominatim(query: string): Promise<NominatimResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("nominatim");
  const data = (await res.json()) as NominatimResult[];
  return data?.[0] ?? null;
}

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function feeForKm(km: number): number | "out" {
  const k = Math.ceil(km);
  if (k <= 2) return 0;
  if (k <= 4) return 3;
  if (k === 5) return 4;
  if (k <= MAX_DELIVERY_KM) return 6;
  return "out";
}

export type DeliveryQuote =
  | { ok: true; fee: number; distanceKm: number | null; source: "bairro" | "distancia" }
  | { ok: false; reason: "out_of_area"; distanceKm: number }
  | { ok: false; reason: "api_failed" };

export async function quoteDelivery(input: {
  street?: string;
  number?: string;
  neighborhood?: string;
  cep?: string;
}): Promise<DeliveryQuote> {
  const { street = "", number = "", neighborhood = "", cep = "" } = input;

  const bairroFee = await getFeeByNeighborhood(neighborhood);
  if (bairroFee !== null) {
    return { ok: true, fee: bairroFee, distanceKm: null, source: "bairro" };
  }

  const sweep = getFeeFromSweep(neighborhood);
  if (sweep !== null) {
    return { ok: true, fee: sweep.fee, distanceKm: sweep.km, source: "distancia" };
  }

  try {
    let res: NominatimResult | null = null;
    const fullQuery = `${street} ${number} ${neighborhood} Sorocaba SP Brazil`.trim();
    if ((street || neighborhood).trim().length > 0) {
      res = await nominatim(fullQuery);
    }
    if (!res && cep) {
      res = await nominatim(`${cep} Sorocaba SP Brazil`);
    }
    if (!res) return { ok: false, reason: "api_failed" };

    const lat = parseFloat(res.lat);
    const lon = parseFloat(res.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return { ok: false, reason: "api_failed" };
    }
    const km = haversineKm(ORIGIN, { lat, lon });
    const fee = feeForKm(km);
    if (fee === "out") return { ok: false, reason: "out_of_area", distanceKm: km };
    return { ok: true, fee, distanceKm: km, source: "distancia" };
  } catch {
    return { ok: false, reason: "api_failed" };
  }
}
