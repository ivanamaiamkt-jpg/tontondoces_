import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/abandoned-cart";

const UTM_KEY = "tonton_utm";
const VISIT_RECORDED_KEY = "tonton_visit_recorded";

type StoredUtm = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

/** Lê utm_source/medium/campaign da URL (se vierem) e guarda no localStorage,
 * pra continuar "grudado" mesmo se a pessoa navegar por outras páginas depois. */
export function captureUtmFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm_source = params.get("utm_source");
  const utm_medium = params.get("utm_medium");
  const utm_campaign = params.get("utm_campaign");
  if (!utm_source && !utm_medium && !utm_campaign) return;
  try {
    localStorage.setItem(
      UTM_KEY,
      JSON.stringify({ utm_source, utm_medium, utm_campaign } satisfies StoredUtm),
    );
  } catch {
    // ignore
  }
}

export function getStoredUtm(): StoredUtm {
  if (typeof window === "undefined") return { utm_source: null, utm_medium: null, utm_campaign: null };
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return { utm_source: null, utm_medium: null, utm_campaign: null };
    return JSON.parse(raw) as StoredUtm;
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
}

/** Grava uma visita por sessão (dedupe local + session_id único no banco). */
export async function recordVisit() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(VISIT_RECORDED_KEY)) return;
  } catch {
    // ignore
  }
  const session_id = getSessionId();
  if (!session_id) return;
  const utm = getStoredUtm();
  try {
    await supabase.from("site_visits" as never).upsert(
      {
        session_id,
        ...utm,
        landing_path: window.location.pathname,
      } as never,
      { onConflict: "session_id", ignoreDuplicates: true } as never,
    );
    sessionStorage.setItem(VISIT_RECORDED_KEY, "1");
  } catch (e) {
    console.error("recordVisit error:", e);
  }
}
