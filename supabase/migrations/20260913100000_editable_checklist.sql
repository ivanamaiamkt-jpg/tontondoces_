-- =========================================================
-- Torna a rotina editável: tarefas viram registros (não mais fixas no código),
-- podendo ser adicionadas, editadas e movidas entre Manhã/Tarde/Fechamento.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly')),
  block TEXT NOT NULL,
  label TEXT NOT NULL,
  link_to TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage checklist items" ON public.checklist_items;
CREATE POLICY "Admins manage checklist items" ON public.checklist_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Recria checklist_state referenciando o item de verdade (antes era uma string fixa)
DROP TABLE IF EXISTS public.checklist_state;
CREATE TABLE public.checklist_state (
  period_key TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (period_key, item_id)
);

ALTER TABLE public.checklist_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage checklist state" ON public.checklist_state;
CREATE POLICY "Admins manage checklist state" ON public.checklist_state
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Semente inicial (só roda na primeira vez — se a tabela já tiver linhas, não duplica)
INSERT INTO public.checklist_items (frequency, block, label, link_to, sort_order)
SELECT * FROM (VALUES
  ('daily','Manhã','Ver pedidos novos','/admin/pedidos',1),
  ('daily','Manhã','Checar o que falta comprar pra produção de hoje',NULL,2),
  ('daily','Manhã','Planejar quanto vai produzir hoje',NULL,3),
  ('daily','Manhã','Postar ou agendar conteúdo da manhã',NULL,4),
  ('daily','Tarde','Produzir os pedidos',NULL,1),
  ('daily','Tarde','Atualizar itens esgotados no cardápio, se precisar','/admin/cardapio',2),
  ('daily','Tarde','Responder clientes (WhatsApp/Instagram)',NULL,3),
  ('daily','Tarde','Despachar pedidos prontos pro motoboy','/admin/pedidos',4),
  ('daily','Tarde','Postar ou agendar conteúdo da tarde',NULL,5),
  ('daily','Fechamento','Lançar vendas do dia','/admin/financeiro',1),
  ('daily','Fechamento','Pedir avaliação de quem recebeu hoje','/admin/pedidos',2),
  ('daily','Fechamento','Postar ou agendar conteúdo da noite',NULL,3),
  ('weekly','Semanal','Revisar cardápio (preços, fotos, itens parados)','/admin/cardapio',1),
  ('weekly','Semanal','Planejar compras da semana',NULL,2),
  ('weekly','Semanal','Dar uma olhada em Financeiro/Visitas da semana','/admin/financeiro',3)
) AS v(frequency, block, label, link_to, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_items);
