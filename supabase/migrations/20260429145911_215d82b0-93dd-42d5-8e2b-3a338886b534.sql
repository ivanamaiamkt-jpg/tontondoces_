ALTER TABLE public.orders
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);