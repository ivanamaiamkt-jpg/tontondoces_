// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_TO = "diretorios.tonton@gmail.com";

// WhatsApp via CallMeBot (api.callmebot.com) — grátis, pensado pra notificação pessoal.
// Número: lido de store_settings (chave "whatsapp", a mesma da tela Configurações),
// com CALLMEBOT_PHONE como fallback se essa configuração estiver vazia.
// CALLMEBOT_APIKEY (recebido ao ativar o bot com esse número) continua sendo secret da function.
async function sendWhatsAppAlert(text: string, phoneOverride: string | null): Promise<boolean> {
  const phone = phoneOverride || Deno.env.get("CALLMEBOT_PHONE");
  const apikey = Deno.env.get("CALLMEBOT_APIKEY");
  if (!phone || !apikey) return false;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("CallMeBot error:", await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("CallMeBot fetch failed:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const { data: settingRow } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "whatsapp")
      .maybeSingle();
    const ownerPhone: string | null = settingRow?.value || null;

    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: carts, error } = await supabase
      .from("carrinhos_abandonados")
      .select("*")
      .eq("status", "ativo")
      .lt("atualizado_em", cutoff);

    if (error) throw error;

    let sent = 0;
    for (const c of carts ?? []) {
      const itens = Array.isArray(c.itens) ? c.itens : [];
      const itensHtml = itens
        .map((it: any) => {
          const qtd = it.quantidade ?? it.quantity ?? 1;
          const nome = it.nome ?? it.productName ?? "Item";
          const subtotal = Number(it.preco_total ?? (it.preco_unitario ?? it.unitPrice ?? 0) * qtd);
          return `<p style="font-size:13px;color:#1a1a1a;margin:4px 0">• ${qtd}x ${nome} — R$ ${subtotal.toFixed(2).replace(".", ",")}</p>`;
        })
        .join("");

      const total = Number(c.total ?? 0).toFixed(2).replace(".", ",");
      const nome = c.nome ?? "Cliente";
      const primeiroNome = nome.split(" ")[0];
      const telefoneLimpo = (c.telefone ?? "").replace(/\D/g, "");

      const itensTxt = itens
        .map((it: any) => {
          const qtd = it.quantidade ?? it.quantity ?? 1;
          const n = it.nome ?? it.productName ?? "Item";
          const subtotal = Number(it.preco_total ?? (it.preco_unitario ?? it.unitPrice ?? 0) * qtd);
          return `• ${qtd}x ${n} — R$ ${subtotal.toFixed(2).replace(".", ",")}`;
        })
        .join("\n");

      const waMsg = `Oi ${primeiroNome}! 🍫 Vi que você estava montando um pedido aqui na TonTon e ficou por aqui...\n\nVocê tinha separado:\n${itensTxt}\n\nTotal: R$ ${total}\n\nSeus docinhos ainda estão te esperando! Posso te ajudar a finalizar? 💕`;
      const waMsgEncoded = encodeURIComponent(waMsg);

      // Mensagem que a dona recebe no WhatsApp (resumo + link pronto pra falar com o cliente).
      const contatoLine = telefoneLimpo
        ? `📱 Contato: ${c.telefone}\n👉 Responder: https://wa.me/55${telefoneLimpo}?text=${waMsgEncoded}`
        : `⚠️ Cliente não informou telefone ainda.`;
      const ownerAlertMsg = `🛒 *Carrinho abandonado — TonTon Doces*\n\n${nome} montou um pedido há mais de 5 min e não finalizou.\n\n📦 Itens:\n${itensTxt}\n\n💰 Total: R$ ${total}\n\n${contatoLine}`;

      const waBlock = telefoneLimpo
        ? `<p style="font-size:14px;color:#3d1a5e;margin:16px 0 8px"><strong>📱 WhatsApp:</strong> ${c.telefone}</p>
           <a href="https://wa.me/55${telefoneLimpo}?text=${waMsgEncoded}"
              style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;margin:8px 0">
              💬 Enviar mensagem no WhatsApp
           </a>`
        : `<p style="font-size:14px;color:#a04848;margin:16px 0">⚠️ Cliente não informou o telefone ainda.</p>`;

      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5efe6;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:24px">
          <div style="background:#3d1a5e;color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:22px">TonTon Doces</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:.85">Carrinho Abandonado</p>
          </div>
          <div style="padding:24px">
            <p style="font-size:15px;color:#1a1a1a;margin:0 0 12px">Oi! 👋</p>
            <p style="font-size:14px;color:#1a1a1a;margin:0 0 20px"><strong>${nome}</strong> montou um pedido há mais de 5 minutos e não finalizou.</p>
            <div style="background:#faf5ed;border-radius:12px;padding:16px;margin:0 0 12px">
              <p style="font-size:12px;color:#7a6a5a;margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px"><strong>📦 Itens do carrinho</strong></p>
              ${itensHtml}
              <p style="font-size:15px;color:#3d1a5e;margin:12px 0 0"><strong>💰 Total: R$ ${total}</strong></p>
            </div>
            ${waBlock}
            <p style="font-size:12px;color:#999;margin:24px 0 0;text-align:center">Se o pedido já foi finalizado pelo WhatsApp, ignore este email. 💕</p>
          </div>
        </div>
      </body></html>`;

      const subject = `🛒 ${nome} deixou um carrinho abandonado — TonTon Doces`;

      const whatsappOk = await sendWhatsAppAlert(ownerAlertMsg, ownerPhone);

      let emailOk = false;
      if (RESEND_API_KEY) {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TonTon Doces <onboarding@resend.dev>",
            to: [ALERT_TO],
            subject,
            html,
          }),
        });
        if (resp.ok) emailOk = true;
        else console.error("Resend error:", await resp.text());
      }

      if (whatsappOk || emailOk) {
        await supabase
          .from("carrinhos_abandonados")
          .update({ status: "notificado", atualizado_em: new Date().toISOString() })
          .eq("id", c.id);
        sent++;
      }
    }

    return new Response(JSON.stringify({ checked: carts?.length ?? 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
