-- =========================================================
-- Novo pipeline de status do Kanban de pedidos:
-- novo -> em_producao -> aguardando_entrega -> na_rua -> entregue
-- "pronto" deixa de existir como status; pedidos que estavam lá
-- viram "aguardando_entrega" (conservador: assume que ainda não
-- saíram pra entrega).
-- "Aguardando pós-venda" não é uma coluna nova — é um selo em
-- cima de "entregue", controlado por esta nova coluna booleana.
-- =========================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_venda_feito BOOLEAN NOT NULL DEFAULT false;

UPDATE public.orders SET status = 'aguardando_entrega' WHERE status = 'pronto';
