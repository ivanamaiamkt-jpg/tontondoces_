// Chave PIX da loja: vem de Admin > Configurações (store_settings.pix_key). Se não estiver
// preenchida (ou o banco não responder), vale a chave padrão abaixo.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_PIX_KEY = "diretorios.tonton@gmail.com";

let pending: Promise<string> | null = null;

async function fetchPixKey(): Promise<string> {
  try {
    const { data } = (await supabase
      .from("store_settings" as never)
      .select("value")
      .eq("key", "pix_key")
      .maybeSingle()) as unknown as { data: { value: string } | null };
    const v = (data?.value ?? "").trim();
    return v || DEFAULT_PIX_KEY;
  } catch {
    return DEFAULT_PIX_KEY;
  }
}

/** Busca a chave (usada fora de componentes, ex.: mensagens do painel). */
export function getPixKey(): Promise<string> {
  pending ??= fetchPixKey();
  return pending;
}

/** Chave PIX atual (começa com a padrão e troca assim que o banco responde). */
export function usePixKey(): string {
  const [key, setKey] = useState(DEFAULT_PIX_KEY);

  useEffect(() => {
    let alive = true;
    getPixKey().then((k) => {
      if (alive) setKey(k);
    });
    return () => {
      alive = false;
    };
  }, []);

  return key;
}
