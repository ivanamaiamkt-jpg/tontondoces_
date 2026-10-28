-- =========================================================
-- Entrega própria de volta (junto com retirada e Uber).
-- 1) orders guarda a distância calculada e o CEP da entrega.
-- 2) Ajustes editáveis em Admin > Configurações: entrega ligada/desligada, raio (km de carro),
--    taxa por km e tempo médio. Padrão: 7 km, R$ 1,10 por km (arredondando pra cima), 60 min.
-- Idempotente: pode rodar mais de uma vez.
-- =========================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_km NUMERIC,
  ADD COLUMN IF NOT EXISTS cep TEXT;

INSERT INTO public.store_settings (key, value) VALUES
  ('delivery_enabled', 'true'),
  ('delivery_max_km', '7'),
  ('delivery_fee_per_km', '1.10'),
  ('delivery_eta_min', '60')
ON CONFLICT (key) DO NOTHING;
