// Formas de pagamento do pedido (orders.payment_method é texto livre no banco).
//   pix        — cliente paga por PIX adiantado
//   maquininha — cartão na maquininha, na retirada ou na entrega (o Uber não leva maquininha)
//   link       — a loja cria um link de pagamento e manda pelo WhatsApp; o cliente paga online
export type PaymentMethod = "pix" | "maquininha" | "link";

type Receiving = "pickup" | "uber" | "delivery";

/** Formas que o cliente pode escolher em cada tipo de recebimento. */
export const PAYMENTS_BY_RECEIVING: Record<Receiving, PaymentMethod[]> = {
  pickup: ["pix", "maquininha"],
  delivery: ["pix", "maquininha", "link"],
  uber: ["pix", "link"],
};

/** Nome curto para o painel e as listas. */
export function paymentLabel(method: string | null | undefined): string {
  if (method === "pix") return "PIX";
  if (method === "link") return "Link de pagamento";
  return "Maquininha";
}
