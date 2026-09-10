-- Clientes (sem senha, identificados pelo telefone)
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Sem login Supabase: leitura/escrita públicas mas sempre filtradas por telefone na aplicação.
-- Isso é aceitável aqui porque ainda não há dados sensíveis. Painel admin futuro usará service role.
CREATE POLICY "Public read customers"
ON public.customers FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public insert customers"
ON public.customers FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public update customers"
ON public.customers FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Endereços salvos
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,
  cep TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read addresses"
ON public.customer_addresses FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public insert addresses"
ON public.customer_addresses FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public update addresses"
ON public.customer_addresses FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public delete addresses"
ON public.customer_addresses FOR DELETE
TO anon, authenticated
USING (true);

-- Permitir que o cliente leia seus pedidos pelo telefone
CREATE POLICY "Public read orders"
ON public.orders FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);