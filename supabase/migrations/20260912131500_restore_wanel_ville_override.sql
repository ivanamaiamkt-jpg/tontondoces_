-- =========================================================
-- A importação dos ~502 bairros (migration anterior) usa
-- ON CONFLICT ... DO UPDATE, então sobrescreveu sem querer a
-- taxa fixa de R$5,00 do Wanel Ville (pedido explícito da dona
-- da loja) com o valor calculado por distância. Restaura o
-- override manual.
-- =========================================================

UPDATE public.delivery_fees SET fee = 5.00
WHERE neighborhood IN (
  'Jardim Wanel Ville I',
  'Jardim Wanel Ville II',
  'Wanel Ville III',
  'Jardim Wanel Ville IV',
  'Jardim Wanel Ville V'
);
