
CREATE TABLE public.carrinhos_abandonados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  nome text NOT NULL,
  telefone text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_carrinhos_abandonados_status_atualizado
  ON public.carrinhos_abandonados (status, atualizado_em);

ALTER TABLE public.carrinhos_abandonados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert abandoned carts"
  ON public.carrinhos_abandonados FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update abandoned carts"
  ON public.carrinhos_abandonados FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can read abandoned carts"
  ON public.carrinhos_abandonados FOR SELECT TO anon, authenticated
  USING (true);
