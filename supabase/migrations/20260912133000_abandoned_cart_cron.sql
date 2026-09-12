-- =========================================================
-- Agenda a checagem de carrinho abandonado a cada 5 minutos,
-- chamando a Edge Function alerta-carrinho-abandonado via pg_net.
--
-- ⚠️ ANTES DE RODAR: troque <SERVICE_ROLE_KEY> abaixo pela chave
-- service_role do projeto (Cloud > Secrets, ou Project Settings >
-- API no Supabase). Sem isso a chamada HTTP retorna 401 e o
-- alerta nunca dispara. Não deixe essa chave em nenhum outro
-- lugar do repositório além desta linha, já preenchida direto no
-- SQL editor.
-- =========================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alerta-carrinho-abandonado') THEN
    PERFORM cron.unschedule('alerta-carrinho-abandonado');
  END IF;
END $$;

SELECT cron.schedule(
  'alerta-carrinho-abandonado',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zaumvzadlbpnzvcxngxe.supabase.co/functions/v1/alerta-carrinho-abandonado',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  )
  $$
);
