-- Promoção "2 por R$ 40,00" nos copos grandes: o pedido guarda quanto de desconto foi dado
-- (subtotal - desconto + taxa de entrega = total). Idempotente.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC;
