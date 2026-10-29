-- =========================================================
-- PRIVACIDADE, ETAPA 2: fecha o acesso aberto.
-- Só rode depois que o site novo (que usa as funções da etapa 1) estiver publicado.
--
-- Depois disto, quem tem só a chave pública do site NÃO consegue mais ler pedidos, clientes,
-- endereços nem carrinhos abandonados, nem alterar/apagar clientes e endereços. O site continua
-- criando pedidos (INSERT em orders) e usando as funções da etapa 1.
-- Idempotente.
-- =========================================================

-- Pedidos: some a leitura pública (o painel lê pela política "Admins read orders").
DROP POLICY IF EXISTS "Public read orders by phone" ON public.orders;

-- Clientes: leitura, edição e criação passam pela função upsert_customer.
DROP POLICY IF EXISTS "Public read customers by phone" ON public.customers;
DROP POLICY IF EXISTS "Public update own customer" ON public.customers;
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;

-- Endereços salvos: a tela de endereços saiu do site; só o painel acessa.
DROP POLICY IF EXISTS "Public read addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Public update addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Public delete addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Public insert addresses" ON public.customer_addresses;

-- Carrinhos abandonados: o site usa as funções; leitura e edição só do painel.
DROP POLICY IF EXISTS "Public can read abandoned carts" ON public.carrinhos_abandonados;
DROP POLICY IF EXISTS "Public can update abandoned carts" ON public.carrinhos_abandonados;
DROP POLICY IF EXISTS "Public can insert abandoned carts" ON public.carrinhos_abandonados;

-- Tabela antiga de carrinhos (sem uso no site): tira a escrita pública.
DROP POLICY IF EXISTS "Public update own abandoned" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Public insert abandoned" ON public.abandoned_carts;
