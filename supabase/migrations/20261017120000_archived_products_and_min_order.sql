-- =========================================================
-- 1) Produtos arquivados: somem do site e ficam na aba "Arquivados" do painel.
-- 2) Pedido mínimo editável em Admin > Configurações (padrão R$15).
-- Idempotente: pode rodar mais de uma vez.
-- =========================================================

ALTER TABLE public.product_availability
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.store_settings (key, value)
VALUES ('min_order', '15')
ON CONFLICT (key) DO NOTHING;

-- Itens com Oreo saem do cardápio (continuam guardados na aba Arquivados).
INSERT INTO public.product_availability (product_id, is_available, archived)
VALUES
  ('gourmet-brig-oreo', true, true),
  ('gourmet-brig-ninho-oreo', true, true),
  ('gourmet-nuvem-oreo', true, true)
ON CONFLICT (product_id) DO UPDATE SET archived = true, is_available = true;
