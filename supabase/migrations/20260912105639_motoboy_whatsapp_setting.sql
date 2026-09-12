-- =========================================================
-- WhatsApp do motoboy (config editável em Admin > Configurações)
-- Seed inicial: Alvaro. DO NOTHING pra não sobrescrever se já
-- tiver sido editado manualmente antes desta migration rodar.
-- =========================================================

INSERT INTO public.store_settings (key, value) VALUES
  ('motoboy_whatsapp', '5515998244807')
ON CONFLICT (key) DO NOTHING;
