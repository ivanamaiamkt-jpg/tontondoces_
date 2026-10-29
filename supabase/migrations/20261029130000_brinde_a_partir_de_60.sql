-- Brinde: pedidos a partir de R$ 60 (sem contar a entrega) ganham um brinde. Editável em
-- Admin > Configurações ("Brinde a partir de"; 0 desliga). Idempotente.
INSERT INTO public.store_settings (key, value) VALUES ('gift_min', '60')
ON CONFLICT (key) DO NOTHING;
