# TonTon Doces 

Crie uma aplicação web completa para a doceria artesanal "TonTon Doces". Sistema de cardápio online premium com painel de gestão para a proprietária.

---

🎨 IDENTIDADE VISUAL

- Estilo: premium, feminino, elegante, quente — inspirado na própria marca TonTon Doces

- Paleta: roxo escuro (#3d1a5e), dourado/mostarda (#c8962a), creme/off-white, chocolate

- Fontes: serifada elegante para títulos (ex: Playfair Display), sans-serif para textos

- Mobile-first: o site precisa ser perfeito no celular

- Nas seções de categoria, usar banners com título centralizado em fundo roxo escuro (exatamente como o cardápio atual da marca)

---

🛍️ ÁREA DO CLIENTE

FLUXO DE ENTREGA (ANTES do cardápio):

Na entrada do site, antes de mostrar o cardápio, exibir uma tela de seleção de modalidade:

- "Quero Entrega" → pede o CEP

- "Vou Retirar no Local" → segue direto para o cardápio

Se escolher ENTREGA:

1. Campo de CEP com máscara (00000-000)

2. Ao digitar o CEP, consultar automaticamente a API https://viacep.com.br/ws/[CEP]/json/ e preencher: rua, bairro, cidade

3. Após preencher, mostrar a taxa de entrega do bairro detectado

4. Se o bairro não estiver cadastrado: mostrar mensagem "Entrega sob consulta — fale com a gente no WhatsApp" com botão de link

5. Salvar CEP e endereço na sessão para pré-preencher o checkout

TAXA DE ENTREGA POR BAIRRO:

No painel admin haverá uma tabela de bairros x taxa. Exemplos iniciais (a proprietária editará):

- Centro: R$ 5,00

- Vila Nova: R$ 7,00

- Jardim América: R$ 8,00

- Bairro Industrial: R$ 10,00

- Demais bairros: "sob consulta"

A taxa calculada aparece no carrinho e no resumo do pedido.

---

📦 CARDÁPIO — CATEGORIAS E PRODUTOS

CATEGORIA 1: "Copo da Felicidade — Escolha o Sabor!"

Descrição da categoria: "Nosso campeão de vendas: copo super recheado com brownie e brigadeiro ou cremes gourmet."

Produto único com seleção de sabor obrigatória (radio button com foto e descrição):

- Doce Encanto — Brigadeiro & Ninho | Brownie macio, brigadeiro gourmet e mousse de Ninho super cremosa. Finalizado com ganache generosa.

- Nevadinho — Mousse de Ninho & Ganache | Brownie macio, mousse de Ninho super cremoso e camada generosa de ganache de chocolate.

- Pecado em Dobro — Brigadeiro & Ninho | Brownie + Ninho + Chocolate + Ganache. O copo mais esperado.

- Prazer em Camadas — Brigadeiro Gourmet | Brownie + brigadeiro de chocolate + ganache.

[Permitir que a proprietária adicione novos sabores facilmente]

CATEGORIA 2: "Bombom no Pote — Escolha o Sabor!"

Descrição: "Bombom no pote bem recheado com creme e fruta. Escolha seu sabor e a fruta: uva, morango ou misto."

Produto único com seleção de sabor obrigatória:

- Bombom de Uva Gourmet no Pote | Camadas de brigadeiro de Ninho, brigadeiro 70% cacau e ganache, com uvas frescas.

- Bombom de Morango no Pote com Mousse de Leite Ninho | Finalizado com ganache e granulado.

- Bombom de Pote Misto | Morangos e uvas, brigadeiro cremoso 70% cacau, brigadeiro de Ninho, ganache e granulado especial.

- Bombom de Uva com Brigadeiro de Ninho | Coberto com ganache de chocolate cremosa.

CATEGORIA 3: "Combos pra Dividir ou Só Curtir"

Banner com foto de destaque. Produtos com preço original riscado e preço promocional:

- Doce Ritual | 1 Copo da Felicidade + 1 Camafeu | De R$ 55,00 por R$ 41,90

- Combo Date Doce — 2 Copos da Felicidade | Escolha dois sabores diferentes | De R$ 70,00 por R$ 55,90

- Experiência a Dois — 1 Copo da Felic. + 1 Bombom no Pote + 2 Camafeus | De R$ 103,90 por R$ 85,50

[Combos permitem seleção de sabores para cada item incluso]

CATEGORIA 4: "Pra Chamar de Meu"

Banner com foto de destaque (morango e uva com chocolate). Produtos individuais:

- Surpresa de Uva | Uva fresquinha no abraço cremoso de brigadeiro de Ninho com cobertura de chocolate | R$ 14,00

- Espetinho de Uva com Brigadeiro de Ninho e Cobertura de Chocolate | 3 uvinhas, muito Ninho e toque final de chocolate | R$ 20,00

- Espetinho de Morango com Brigadeiro de Ninho | 3 morangos + brigadeiro de Ninho + chocolate | R$ 25,00

- Brigadeiro Gourmet Recheado com Bolacha Oreo | Recheado com pedaços crocantes de Oreo | R$ 9,99

[A proprietária poderá adicionar mais produtos nessa categoria e em categorias novas]

---

🛒 CARRINHO E CHECKOUT

Carrinho lateral (slide-in) com:

- Lista de itens com sabores selecionados

- Subtotal dos produtos

- Taxa de entrega (calculada pelo bairro do CEP) ou "Retirada grátis"

- Total geral

Checkout:

- Nome completo

- WhatsApp (com máscara)

- Endereço pré-preenchido pelo CEP (editável): rua, número, complemento, bairro, cidade

- Data e horário desejado para entrega/retirada

- Observações

- Forma de pagamento: PIX ou Dinheiro na entrega (com campo de troco se dinheiro)

- Resumo final do pedido antes de confirmar

Após finalizar: página de confirmação com número do pedido e mensagem de agradecimento da TonTon Doces.

---

👤 CONTA DO CLIENTE

- Cadastro e login (e-mail + senha ou Google)

- Área "Meus Pedidos" com histórico e status de cada pedido

- Endereços salvos (para não digitar o CEP toda vez)

---

🔧 PAINEL ADMINISTRATIVO (/admin — login protegido)

DASHBOARD:

- Pedidos: hoje / semana / mês

- Receita do período

- Clientes ativos (compraram nos últimos 30 dias)

- Clientes inativos (mais de 30 dias sem compra)

- Taxa de conversão (visitantes → pedidos finalizados)

- Carrinhos abandonados do dia

- Gráfico de pedidos por dia (últimos 30 dias)

- Produtos mais vendidos e ticket médio

PEDIDOS:

- Lista com status: Novo / Em produção / Pronto / Entregue / Cancelado

- A proprietária atualiza o status manualmente

- Cada pedido mostra: itens + sabores, endereço, forma de pagamento, observações

- Botão "Confirmar pedido no WhatsApp" → abre wa.me com mensagem pré-preenchida:

  "Olá [NOME]! 🍫 Seu pedido #[NÚMERO] foi confirmado! Itens: [LISTA]. Total: R$[VALOR] + R$[FRETE] de entrega. Previsão: [DATA/HORA]. Qualquer dúvida é só chamar! 💕 TonTon Doces"

CARRINHOS ABANDONADOS:

- Lista de clientes com carrinho há mais de 15 minutos sem finalizar

- Mostra: nome, itens no carrinho, há quanto tempo abandonou

- Botão "Enviar lembrete WhatsApp" → abre wa.me com mensagem pré-preenchida:

  "Oi [NOME]! 🍬 Seus docinhos ainda estão te esperando por aqui hein! Você tinha separado: [ITENS]. Finaliza o pedido? A gente faz com muito amor pra você 💕"

CLIENTES:

- Lista completa com filtro: Frequentes / Inativos (+30 dias)

- Ver histórico de pedidos por cliente

- Botão de contato WhatsApp para clientes inativos

TAXA DE ENTREGA (aba própria):

- Tabela editável: bairro → taxa em R$

- Adicionar, editar e remover bairros

- Campo para definir mensagem de "bairro não cadastrado"

CALCULADORA DE CUSTOS:

- Cadastro de receitas com ingredientes (nome + quantidade + custo)

- Custo de embalagem e tempo de produção

- Cálculo automático: custo por unidade, margem atual, preço sugerido para 50/60/70% de margem

CARDÁPIO (gestão):

- Adicionar/editar/remover produtos e categorias

- Upload de fotos

- Ativar/desativar produto sem excluir

- Gerenciar sabores/variações de cada produto

- Preço original e preço promocional por produto

MÉTRICAS:

- Gráfico de pedidos por dia

- Produtos mais vendidos

- Horários de pico

- Ticket médio

---

⚙️ REQUISITOS TÉCNICOS

- Banco de dados: Supabase

- Autenticação: Supabase Auth

- Consulta de CEP: API ViaCEP (https://viacep.com.br/ws/[CEP]/json/) — gratuita, sem chave

- Carrinhos salvos no banco com timestamp para detectar abandono

- Calcular automaticamente status do cliente (frequente/inativo) pela data do último pedido

- Links WhatsApp: https://wa.me/55[NUMERO]?text=[MENSAGEM_ENCODADA_URI]

- Número de WhatsApp da proprietária configurável no painel admin (settings)

- Mobile-first, painel admin também acessível pelo celular

- Sistema de permissões: cliente só vê suas coisas, admin vê tudo

---

📝 OBSERVAÇÕES

- Os produtos e fotos são exemplos — a proprietária substituirá pelas fotos reais depois

- Não precisa de pagamento online agora (só PIX manual + cartão por maquininha)

- Os bairros e taxas de entrega da tabela são exemplos — a proprietária editará no painel

- Preciso conseguir adicionar novas categorias e produtos com facilidade pelo painel

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tontondoces.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1cf8a7bc-7b17-4363-866f-43d68419730a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
