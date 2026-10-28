// Cálculo da taxa de entrega. Roda só no servidor (chamado por quoteDelivery em delivery.ts).
//
// Regra de ouro: NUNCA aprovar uma entrega sem ter medido a distância de verdade.
// O sistema antigo aprovava quando não conseguia medir (foi assim que um endereço de 9,3 km
// passou), olhava só o nome do bairro e nunca usava o número da casa. Aqui:
//   1. O CEP é conferido pelo código IBGE da cidade (Sorocaba = 3552205) e pela UF.
//   2. A posição do endereço vem do Google (se houver chave) ou, sem chave, das ruas do
//      OpenStreetMap (que não têm número de casa, então a posição é só "aproximada").
//   3. A distância é de CARRO (OSRM), a mesma que o Google Maps mostra.
//   4. Só vira "ok" se TODAS as posições possíveis do endereço couberem no raio; só vira "fora"
//      se NENHUMA couber; qualquer dúvida (ou serviço fora do ar) vira "confirm" — o cliente
//      confirma a taxa pelo WhatsApp em vez de receber um preço errado.

export const STORE_ORIGIN = { lat: -23.46732700953204, lon: -47.4625592865066 };
export const SOROCABA_IBGE = "3552205";
// Folga para diferença entre o OSRM e o Google Maps (alguns % por trajeto).
export const ROUTE_TOLERANCE_KM = 0.35;

const USER_AGENT = "TonTonDoces-entrega/1.0 (ivanamaia.mkt@gmail.com)";
const OSRM_HOSTS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
];

export type DeliveryConfig = { maxKm: number; feePerKm: number };
export type QuoteInput = { cep: string; number: string; street?: string };
export type ResolvedAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
};

export type ConfirmReason =
  | "endereco_nao_encontrado"
  | "servico_indisponivel"
  | "distancia_no_limite"
  | "posicao_imprecisa";

export type DeliveryQuote =
  | { status: "ok"; fee: number; km: number; precise: boolean; address: ResolvedAddress }
  | { status: "out"; reason: "cidade" | "distancia"; km?: number; address?: ResolvedAddress }
  | { status: "confirm"; reason: ConfirmReason; km?: number; address?: ResolvedAddress }
  | { status: "invalid"; reason: "cep" | "numero" };

type Point = { lat: number; lon: number };
type Position = { points: Point[]; precise: boolean };

export function norm(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCep(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function feeForKm(km: number, feePerKm: number): number {
  return Math.round(Math.max(1, Math.ceil(km)) * feePerKm * 100) / 100;
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${url.split("?")[0]}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- CEP

export type CepData = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
};

/** null = CEP não existe. Lança erro se NENHUM serviço de CEP respondeu. */
export async function lookupCep(digits: string): Promise<CepData | null> {
  let reached = false;
  try {
    const d = (await fetchJson(`https://viacep.com.br/ws/${digits}/json/`)) as Record<string, string>;
    reached = true;
    if (!d.erro) {
      return {
        street: d.logradouro ?? "",
        neighborhood: d.bairro ?? "",
        city: d.localidade ?? "",
        state: d.uf ?? "",
        ibge: String(d.ibge ?? ""),
      };
    }
  } catch {
    // tenta o próximo
  }
  try {
    const d = (await fetchJson(`https://brasilapi.com.br/api/cep/v1/${digits}`)) as Record<string, any>;
    reached = true;
    if (d && d.cep) {
      return {
        street: d.street ?? "",
        neighborhood: d.neighborhood ?? "",
        city: d.city ?? "",
        state: d.state ?? "",
        ibge: String(d.city_ibge ?? d.ibge?.city ?? ""),
      };
    }
  } catch {
    // ignore
  }
  if (!reached) throw new Error("cep_service_down");
  return null;
}

// ------------------------------------------------------------ posição

function cornersOf(bounds: { south: number; north: number; west: number; east: number }): Point[] {
  return [
    { lat: bounds.south, lon: bounds.west },
    { lat: bounds.south, lon: bounds.east },
    { lat: bounds.north, lon: bounds.west },
    { lat: bounds.north, lon: bounds.east },
  ];
}

/** Interpreta a resposta do Geocoding API do Google. Exportada para teste. */
export function parseGoogleGeocode(
  json: any,
  typed: { street: string; number: string },
): Position | "not_found" {
  if (!json || json.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0) {
    return "not_found";
  }
  const r = json.results[0];
  const comps: any[] = r.address_components ?? [];
  const get = (type: string) => comps.find((c) => (c.types ?? []).includes(type));
  const locality = norm(get("administrative_area_level_2")?.long_name ?? get("locality")?.long_name);
  const uf = (get("administrative_area_level_1")?.short_name ?? "").toUpperCase();
  if (locality !== "sorocaba" || uf !== "SP") return "not_found";

  const loc = r.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return "not_found";
  const center = { lat: loc.lat, lon: loc.lng };

  const locationType = r.geometry?.location_type as string | undefined;
  const route = norm(get("route")?.long_name);
  const typedStreet = norm(typed.street);
  // A rua devolvida precisa "parecer" a rua digitada (o Google às vezes casa outra rua parecida).
  const streetTokens = typedStreet.split(" ").filter((t) => t.length > 3);
  const hits = streetTokens.filter((t) => route.includes(t)).length;
  const routeOk = !typedStreet || streetTokens.length === 0 || hits / streetTokens.length >= 0.5;
  const digitsOf = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const numberOk =
    digitsOf(get("street_number")?.long_name) !== "" &&
    digitsOf(get("street_number")?.long_name) === digitsOf(typed.number);

  const exact =
    (locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED") &&
    !r.partial_match &&
    routeOk &&
    numberOk;
  if (exact) return { points: [center], precise: true };

  // Posição aproximada: usa o centro e as pontas da rua para medir o pior e o melhor caso.
  const b = r.geometry?.bounds ?? r.geometry?.viewport;
  const points = [center];
  if (b?.southwest && b?.northeast) {
    points.push(
      ...cornersOf({
        south: b.southwest.lat,
        north: b.northeast.lat,
        west: b.southwest.lng,
        east: b.northeast.lng,
      }),
    );
  }
  if (!routeOk) return "not_found";
  return { points, precise: false };
}

async function googlePosition(
  key: string,
  addr: ResolvedAddress,
  number: string,
): Promise<Position | "not_found"> {
  const base = "https://maps.googleapis.com/maps/api/geocode/json";
  const common = `&language=pt-BR&region=br&key=${encodeURIComponent(key)}`;
  const comps = encodeURIComponent("country:BR|administrative_area:SP|locality:Sorocaba");
  const queries = [
    `${addr.street}, ${number}, ${addr.neighborhood}, Sorocaba - SP, ${addr.cep}`,
    `${addr.street}, ${number}, Sorocaba - SP`,
  ];
  for (const q of queries) {
    const json = await fetchJson(`${base}?address=${encodeURIComponent(q)}&components=${comps}${common}`);
    const status = (json as any)?.status;
    if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT" || status === "OVER_DAILY_LIMIT") {
      throw new Error(`google_${status}`);
    }
    const pos = parseGoogleGeocode(json, { street: addr.street, number });
    if (pos !== "not_found") return pos;
  }
  return "not_found";
}

/** Sem chave do Google: usa as ruas do OpenStreetMap (sem número de casa → sempre aproximado). */
export function pickNominatimPoints(
  results: any[],
  cepDigits: string,
  neighborhood: string,
): Point[] {
  const inSorocaba = results.filter((r) => {
    const a = r.address ?? {};
    const city = norm(a.city ?? a.town ?? a.municipality);
    return city === "sorocaba" && norm(a.state) === "sao paulo";
  });
  const byCep = inSorocaba.filter((r) => String(r.address?.postcode ?? "").replace(/\D/g, "") === cepDigits);
  const nb = norm(neighborhood);
  const byNb = inSorocaba.filter((r) => {
    const sub = norm(r.address?.suburb ?? r.address?.neighbourhood ?? r.address?.city_district);
    return nb && sub && (sub === nb || sub.includes(nb) || nb.includes(sub));
  });
  const chosen = byCep.length ? byCep : byNb.length ? byNb : inSorocaba;
  // Muitos trechos = rua longa/ambígua: só os centros (o roteador aceita ~100 pontos por vez).
  const withCorners = chosen.length <= 12;
  const pts: Point[] = [];
  for (const r of chosen.slice(0, 60)) {
    pts.push({ lat: parseFloat(r.lat), lon: parseFloat(r.lon) });
    const bb = r.boundingbox?.map(parseFloat);
    if (withCorners && bb && bb.length === 4) {
      pts.push(...cornersOf({ south: bb[0], north: bb[1], west: bb[2], east: bb[3] }));
    }
  }
  return pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

async function osmPosition(addr: ResolvedAddress): Promise<Position | "not_found"> {
  const qs = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "40",
    street: addr.street,
    city: "Sorocaba",
    state: "São Paulo",
    country: "Brazil",
  });
  const results = (await fetchJson(`https://nominatim.openstreetmap.org/search?${qs}`)) as any[];
  const points = pickNominatimPoints(results, addr.cep.replace(/\D/g, ""), addr.neighborhood);
  if (points.length === 0) return "not_found";
  return { points, precise: false };
}

// ---------------------------------------------------------- distância

/** Distância de carro (km) da loja até cada ponto, ou null se nenhum roteador respondeu. */
export async function roadDistancesKm(points: Point[]): Promise<(number | null)[] | null> {
  const coords = [STORE_ORIGIN, ...points].map((p) => `${p.lon},${p.lat}`).join(";");
  for (const host of OSRM_HOSTS) {
    try {
      const json = (await fetchJson(
        `${host}/table/v1/driving/${coords}?sources=0&annotations=distance`,
        9000,
      )) as any;
      const row: (number | null)[] | undefined = json?.distances?.[0];
      if (json?.code === "Ok" && Array.isArray(row) && row.length === points.length + 1) {
        return row.slice(1).map((m) => (typeof m === "number" ? m / 1000 : null));
      }
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

/** Decisão pura (testável): com as distâncias de todas as posições possíveis do endereço. */
export function decide(
  kms: (number | null)[],
  precise: boolean,
  cfg: DeliveryConfig,
):
  | { status: "ok"; km: number; fee: number }
  | { status: "out"; km: number }
  | { status: "confirm"; reason: ConfirmReason; km?: number } {
  const valid = kms.filter((k): k is number => typeof k === "number");
  if (valid.length === 0) return { status: "confirm", reason: "servico_indisponivel" };
  // Posição exata: a própria distância. Aproximada: a mediana das posições possíveis.
  const sorted = [...valid].sort((a, b) => a - b);
  const ref = precise && typeof kms[0] === "number" ? (kms[0] as number) : sorted[Math.floor(sorted.length / 2)];
  const dMin = sorted[0];
  const dMax = sorted[sorted.length - 1];
  // Se alguma posição possível ficou sem rota, não dá pra afirmar que cabe no raio.
  const allRouted = valid.length === kms.length;
  if (allRouted && dMax + ROUTE_TOLERANCE_KM <= cfg.maxKm) {
    return { status: "ok", km: ref, fee: feeForKm(ref, cfg.feePerKm) };
  }
  if (dMin - ROUTE_TOLERANCE_KM > cfg.maxKm) return { status: "out", km: dMin };
  return {
    status: "confirm",
    reason: precise ? "distancia_no_limite" : "posicao_imprecisa",
    km: ref,
  };
}

// ------------------------------------------------------------ cotação

export type QuoteEnv = { googleKey?: string };

export async function computeQuote(
  input: QuoteInput,
  cfg: DeliveryConfig,
  env: QuoteEnv = {},
): Promise<DeliveryQuote> {
  const digits = (input.cep ?? "").replace(/\D/g, "");
  const number = (input.number ?? "").trim();
  if (digits.length !== 8) return { status: "invalid", reason: "cep" };
  if (!number || number.length > 12) return { status: "invalid", reason: "numero" };

  let cep: CepData | null;
  try {
    cep = await lookupCep(digits);
  } catch {
    return { status: "confirm", reason: "servico_indisponivel" };
  }
  if (!cep) return { status: "invalid", reason: "cep" };

  const address: ResolvedAddress = {
    street: cep.street || (input.street ?? "").trim(),
    neighborhood: cep.neighborhood,
    city: cep.city,
    state: cep.state,
    cep: formatCep(digits),
  };

  // Conferência pelo código oficial da cidade + UF: barra CEP de outra cidade/estado.
  if (cep.ibge !== SOROCABA_IBGE || cep.state.toUpperCase() !== "SP") {
    return { status: "out", reason: "cidade", address };
  }
  if (!address.street) return { status: "confirm", reason: "endereco_nao_encontrado", address };

  let pos: Position | "not_found";
  try {
    pos = env.googleKey
      ? await googlePosition(env.googleKey, address, number)
      : await osmPosition(address);
  } catch (e) {
    console.error("[entrega] falha ao localizar endereço:", e);
    return { status: "confirm", reason: "servico_indisponivel", address };
  }
  if (pos === "not_found") return { status: "confirm", reason: "endereco_nao_encontrado", address };

  const kms = await roadDistancesKm(pos.points);
  if (!kms) return { status: "confirm", reason: "servico_indisponivel", address };

  const d = decide(kms, pos.precise, cfg);
  if (d.status === "ok") {
    return { status: "ok", fee: d.fee, km: Math.round(d.km * 10) / 10, precise: pos.precise, address };
  }
  if (d.status === "out") {
    return { status: "out", reason: "distancia", km: Math.round(d.km * 10) / 10, address };
  }
  return {
    status: "confirm",
    reason: d.reason,
    km: d.km === undefined ? undefined : Math.round(d.km * 10) / 10,
    address,
  };
}

// ------------------------------------------------- configuração e cache

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = { maxKm: 7, feePerKm: 1.1 };

/** Lê raio e taxa por km do painel (store_settings). Se falhar, usa o padrão. */
export async function loadDeliveryConfig(
  supabaseUrl?: string,
  supabaseKey?: string,
): Promise<DeliveryConfig> {
  if (!supabaseUrl || !supabaseKey) return DEFAULT_DELIVERY_CONFIG;
  try {
    const rows = (await (
      await fetch(
        `${supabaseUrl}/rest/v1/store_settings?select=key,value&key=in.(delivery_max_km,delivery_fee_per_km)`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      )
    ).json()) as { key: string; value: string }[];
    const get = (k: string, fallback: number) => {
      const n = Number(String(rows.find((r) => r.key === k)?.value ?? "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return {
      maxKm: get("delivery_max_km", DEFAULT_DELIVERY_CONFIG.maxKm),
      feePerKm: get("delivery_fee_per_km", DEFAULT_DELIVERY_CONFIG.feePerKm),
    };
  } catch {
    return DEFAULT_DELIVERY_CONFIG;
  }
}

const quoteCache = new Map<string, { at: number; quote: DeliveryQuote }>();
const CACHE_MS = 10 * 60 * 1000;

/** Cotação com cache curto: o mesmo endereço digitado de novo não gasta chamadas externas. */
export async function cachedQuote(
  input: QuoteInput,
  cfg: DeliveryConfig,
  env: QuoteEnv,
): Promise<DeliveryQuote> {
  const key = [
    input.cep.replace(/\D/g, ""),
    input.number.trim().toLowerCase(),
    norm(input.street),
    cfg.maxKm,
    cfg.feePerKm,
    env.googleKey ? "g" : "o",
  ].join("|");
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.quote;
  const quote = await computeQuote(input, cfg, env);
  // Só guarda resposta firme: erro temporário de serviço não deve ficar preso no cache.
  const firm =
    quote.status === "ok" ||
    quote.status === "out" ||
    (quote.status === "confirm" && quote.reason !== "servico_indisponivel");
  if (firm) {
    if (quoteCache.size > 500) quoteCache.clear();
    quoteCache.set(key, { at: Date.now(), quote });
  }
  return quote;
}
