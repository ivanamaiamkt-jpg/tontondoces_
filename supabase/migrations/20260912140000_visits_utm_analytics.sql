-- =========================================================
-- PAINEL DE VISITAS + RASTREIO DE ORIGEM (UTM)
-- site_visits: uma linha por sessão de visitante (dedupe por
-- session_id), com a origem (utm_source/medium/campaign) que
-- trouxe a pessoa até o site. Leitura só admin, insert público
-- (o próprio visitante grava sua visita).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_utm_source ON public.site_visits(utm_source);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits(created_at);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert visits" ON public.site_visits;
CREATE POLICY "Public insert visits" ON public.site_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read visits" ON public.site_visits;
CREATE POLICY "Admins read visits" ON public.site_visits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Marca a origem (se houver) de carrinhos e pedidos, pra poder
-- quebrar o funil de visitas -> carrinhos -> pedidos por utm_source.
ALTER TABLE public.carrinhos_abandonados ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.carrinhos_abandonados ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.carrinhos_abandonados ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
