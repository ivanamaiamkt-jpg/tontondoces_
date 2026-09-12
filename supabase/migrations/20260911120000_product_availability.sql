
-- =========================================================
-- DISPONIBILIDADE DE PRODUTOS ("esgotado" / "disponível")
-- O catálogo em si (nomes, preços, fotos) continua no código
-- (src/lib/menu-data.ts). Essa tabela só guarda o estado de
-- estoque por produto, editável pelo painel admin e lido pela
-- vitrine. Ausência de linha = disponível (default).
-- =========================================================

CREATE TABLE public.product_availability (
  product_id TEXT PRIMARY KEY,
  is_available BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product availability" ON public.product_availability
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage product availability" ON public.product_availability
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_product_availability_updated BEFORE UPDATE ON public.product_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Marca "Nuvem de Oreo" como esgotado agora.
INSERT INTO public.product_availability (product_id, is_available)
VALUES ('gourmet-nuvem-oreo', false)
ON CONFLICT (product_id) DO UPDATE SET is_available = false;
