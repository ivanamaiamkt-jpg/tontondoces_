-- =========================================================
-- CHECKLIST DE ROTINA: itens diários e semanais marcáveis na Visão geral.
-- period_key = data do dia (itens diários) ou segunda-feira da semana (itens semanais).
-- A existência da linha = item marcado; desmarcar apaga a linha.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.checklist_state (
  period_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (period_key, item_key)
);

ALTER TABLE public.checklist_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage checklist state" ON public.checklist_state;
CREATE POLICY "Admins manage checklist state" ON public.checklist_state
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
