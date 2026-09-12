-- =========================================================
-- CARDÁPIO EDITÁVEL — camada de edição por cima do catálogo
-- estático (src/lib/menu-data.ts), sem migrar tudo pro banco.
--
-- product_overrides: sobrescreve nome/descrição/preço/foto de um
-- produto que já existe no código (null = usa o valor do código),
-- mesmo espírito de product_availability.
-- custom_categories / custom_products: categorias e produtos 100%
-- novos, cadastrados só pelo painel admin.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.product_overrides (
  product_id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  price NUMERIC(10,2),
  image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product overrides" ON public.product_overrides;
CREATE POLICY "Public read product overrides" ON public.product_overrides
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage product overrides" ON public.product_overrides;
CREATE POLICY "Admins manage product overrides" ON public.product_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_product_overrides_updated ON public.product_overrides;
CREATE TRIGGER trg_product_overrides_updated BEFORE UPDATE ON public.product_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active custom categories" ON public.custom_categories;
CREATE POLICY "Public read active custom categories" ON public.custom_categories
  FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage custom categories" ON public.custom_categories;
CREATE POLICY "Admins manage custom categories" ON public.custom_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_custom_categories_updated ON public.custom_categories;
CREATE TRIGGER trg_custom_categories_updated BEFORE UPDATE ON public.custom_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.custom_products (
  id TEXT PRIMARY KEY DEFAULT ('custom-' || replace(gen_random_uuid()::text, '-', '')),
  static_category_id TEXT,
  custom_category_id UUID REFERENCES public.custom_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),
  image_url TEXT,
  badge TEXT,
  unit_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_custom_products_one_category CHECK (num_nonnulls(static_category_id, custom_category_id) = 1)
);

ALTER TABLE public.custom_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active custom products" ON public.custom_products;
CREATE POLICY "Public read active custom products" ON public.custom_products
  FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage custom products" ON public.custom_products;
CREATE POLICY "Admins manage custom products" ON public.custom_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_custom_products_updated ON public.custom_products;
CREATE TRIGGER trg_custom_products_updated BEFORE UPDATE ON public.custom_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bucket público pra fotos de produto (upload feito pelo painel admin).
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images','product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins manage product images" ON storage.objects;
CREATE POLICY "Admins manage product images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

-- =========================================================
-- CALCULADORA DE CUSTO — desacopla de menu_products, que nunca
-- foi populada por ninguém (nem loja nem admin escrevem nela) e
-- por isso o dropdown de produtos ficava sempre vazio.
-- =========================================================

ALTER TABLE public.product_recipes DROP CONSTRAINT IF EXISTS product_recipes_product_id_fkey;

CREATE TABLE IF NOT EXISTS public.product_extra_costs (
  product_id TEXT PRIMARY KEY,
  extra_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_extra_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage extra costs" ON public.product_extra_costs;
CREATE POLICY "Admins manage extra costs" ON public.product_extra_costs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_product_extra_costs_updated ON public.product_extra_costs;
CREATE TRIGGER trg_product_extra_costs_updated BEFORE UPDATE ON public.product_extra_costs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
