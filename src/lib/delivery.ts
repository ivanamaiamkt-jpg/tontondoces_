// Entrega própria: configurações do painel, consulta de CEP no navegador e cotação da taxa.
// A cotação roda no servidor (delivery-quote.server.ts) — ver a regra de ouro lá.
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryQuote, QuoteInput } from "./delivery-quote.server";

export type { DeliveryQuote, QuoteInput, ResolvedAddress } from "./delivery-quote.server";

export const SOROCABA_IBGE = "3552205";

/** Taxa de entrega do endereço: valida CEP, mede a distância de carro e devolve ok / fora / confirmar. */
export const quoteDelivery = createServerFn({ method: "POST" })
  .inputValidator((d: QuoteInput) => d)
  .handler(async ({ data }): Promise<DeliveryQuote> => {
    const { cachedQuote, loadDeliveryConfig } = await import("./delivery-quote.server");
    const cfg = await loadDeliveryConfig(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
    );
    return cachedQuote(
      { cep: String(data.cep ?? ""), number: String(data.number ?? ""), street: data.street },
      cfg,
      { googleKey: process.env.GOOGLE_MAPS_API_KEY },
    );
  });

export type CepInfo = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
};

/** Consulta o CEP no navegador (só para preencher a tela). null = CEP não existe; lança se nenhum serviço respondeu. */
export async function lookupCepClient(digits: string): Promise<CepInfo | null> {
  let reached = false;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (res.ok) {
      reached = true;
      const d = await res.json();
      if (!d.erro) {
        return {
          street: d.logradouro ?? "",
          neighborhood: d.bairro ?? "",
          city: d.localidade ?? "",
          state: d.uf ?? "",
          ibge: String(d.ibge ?? ""),
        };
      }
    }
  } catch {
    // tenta o próximo
  }
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
    if (res.ok) {
      reached = true;
      const d = await res.json();
      return {
        street: d.street ?? "",
        neighborhood: d.neighborhood ?? "",
        city: d.city ?? "",
        state: d.state ?? "",
        ibge: String(d.city_ibge ?? d.ibge?.city ?? ""),
      };
    }
    if (res.status === 404) reached = true;
  } catch {
    // ignore
  }
  if (!reached) throw new Error("cep_service_down");
  return null;
}

// -------------------------------------------------------- configurações

export type DeliverySettings = {
  enabled: boolean;
  maxKm: number;
  feePerKm: number;
  etaMin: number;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  enabled: true,
  maxKm: 7,
  feePerKm: 1.1,
  etaMin: 60,
};

let pending: Promise<DeliverySettings> | null = null;

async function fetchSettings(): Promise<DeliverySettings> {
  try {
    const { data } = (await supabase
      .from("store_settings" as never)
      .select("key,value")
      .in("key", [
        "delivery_enabled",
        "delivery_max_km",
        "delivery_fee_per_km",
        "delivery_eta_min",
      ])) as unknown as { data: { key: string; value: string }[] | null };
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    const num = (k: string, fallback: number) => {
      const n = Number(String(map.get(k) ?? "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return {
      enabled: map.has("delivery_enabled")
        ? String(map.get("delivery_enabled")).trim().toLowerCase() !== "false"
        : DEFAULT_DELIVERY_SETTINGS.enabled,
      maxKm: num("delivery_max_km", DEFAULT_DELIVERY_SETTINGS.maxKm),
      feePerKm: num("delivery_fee_per_km", DEFAULT_DELIVERY_SETTINGS.feePerKm),
      etaMin: num("delivery_eta_min", DEFAULT_DELIVERY_SETTINGS.etaMin),
    };
  } catch {
    return DEFAULT_DELIVERY_SETTINGS;
  }
}

/** Entrega ligada/desligada, raio, taxa por km e tempo médio — editáveis em Admin > Configurações. */
export function useDeliverySettings(): DeliverySettings {
  const [value, setValue] = useState(DEFAULT_DELIVERY_SETTINGS);

  useEffect(() => {
    let alive = true;
    pending ??= fetchSettings();
    pending.then((s) => {
      if (alive) setValue(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return value;
}
