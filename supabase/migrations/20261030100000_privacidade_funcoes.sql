-- =========================================================
-- PRIVACIDADE, ETAPA 1 (só acrescenta; não tira nada de ninguém ainda)
--
-- Pedidos, clientes, endereços e carrinhos abandonados estavam legíveis por qualquer pessoa
-- com a chave pública do site. Aqui criamos:
--   * funções que fazem só o que o site precisa, sem abrir a tabela inteira;
--   * políticas de leitura/edição só para o administrador (hoje o painel lê pedidos pela política
--     pública, que será removida na etapa 2).
-- Idempotente: pode rodar mais de uma vez.
-- =========================================================

-- Cliente: cria ou reaproveita pelo telefone e devolve só o id. Não devolve nem altera dados
-- de quem já existe (antes qualquer um podia ler e editar a tabela).
CREATE OR REPLACE FUNCTION public.upsert_customer(p_name text, p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id uuid;
BEGIN
  IF length(trim(coalesce(p_name, ''))) < 2 OR length(v_phone) < 10 OR length(v_phone) > 13 THEN
    RAISE EXCEPTION 'dados invalidos';
  END IF;
  INSERT INTO public.customers (name, phone, updated_at)
  VALUES (trim(p_name), v_phone, now())
  ON CONFLICT (phone) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Pedidos por id: o id é um código aleatório que só quem fez o pedido (e o motoboy, pelo link)
-- conhece. Devolve só os campos que a tela do cliente e a do motoboy usam, no máximo 50.
CREATE OR REPLACE FUNCTION public.orders_by_ids(p_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      to_jsonb(o) - 'notes_internal' - 'utm_source' - 'utm_medium' - 'utm_campaign'
        - 'customer_id' - 'paid_at' - 'pos_venda_feito'
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.orders o
  WHERE o.id = ANY (p_ids[1:50]);
$$;

-- Carrinho abandonado: o site grava/atualiza o carrinho da própria sessão (código aleatório).
CREATE OR REPLACE FUNCTION public.sync_abandoned_cart(
  p_session uuid,
  p_nome text,
  p_telefone text,
  p_itens jsonb,
  p_total numeric,
  p_status text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := CASE WHEN p_status IN ('ativo', 'convertido', 'notificado') THEN p_status ELSE 'ativo' END;
BEGIN
  IF p_session IS NULL OR length(trim(coalesce(p_nome, ''))) < 2 THEN
    RETURN;
  END IF;
  INSERT INTO public.carrinhos_abandonados
    (session_id, nome, telefone, itens, total, status, atualizado_em, utm_source, utm_medium, utm_campaign)
  VALUES (
    p_session, trim(p_nome),
    nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
    coalesce(p_itens, '[]'::jsonb), coalesce(p_total, 0), v_status, now(),
    p_utm_source, p_utm_medium, p_utm_campaign
  )
  ON CONFLICT (session_id) DO UPDATE SET
    nome = excluded.nome,
    telefone = excluded.telefone,
    itens = excluded.itens,
    total = excluded.total,
    status = excluded.status,
    atualizado_em = now(),
    utm_source = excluded.utm_source,
    utm_medium = excluded.utm_medium,
    utm_campaign = excluded.utm_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_cart_converted(p_session uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.carrinhos_abandonados
  SET status = 'convertido', atualizado_em = now()
  WHERE session_id = p_session;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_customer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_by_ids(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_abandoned_cart(uuid, text, text, jsonb, numeric, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_cart_converted(uuid) TO anon, authenticated;

-- Painel: o administrador lê/edita/apaga tudo (antes dependia da leitura pública).
DROP POLICY IF EXISTS "Admins read orders" ON public.orders;
CREATE POLICY "Admins read orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage carrinhos abandonados" ON public.carrinhos_abandonados;
CREATE POLICY "Admins manage carrinhos abandonados" ON public.carrinhos_abandonados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage addresses" ON public.customer_addresses;
CREATE POLICY "Admins manage addresses" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update customers" ON public.customers;
CREATE POLICY "Admins update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
