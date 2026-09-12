import imgCopo from "@/assets/product-copo.webp";
import imgCopoConforto from "@/assets/produtos/copo-conforto.webp";
import imgBombom from "@/assets/product-bombom.webp";
import imgCombo from "@/assets/product-combo.webp";
import imgIndividual from "@/assets/product-individual.webp";
import imgDoceRitual from "@/assets/produtos/doce-ritual.webp";
import imgComboDateDoce from "@/assets/produtos/combo-date-doce.webp";
import imgExperienciaADois from "@/assets/produtos/experiencia-a-dois.webp";
import imgCamafeu from "@/assets/produtos/camafeu.webp";
import imgDoceEncanto from "@/assets/produtos/doce-encanto.webp";
import imgNevadinho from "@/assets/produtos/nevadinho.webp";
import imgNevadinho2 from "@/assets/produtos/nevadinho-2.webp";
import imgBombomUva from "@/assets/produtos/bombom-copo-uva.jpeg";
import imgBombomMorango from "@/assets/produtos/bombom-copo-morango.jpeg";
import imgBombomMorango2 from "@/assets/produtos/bombom-copo-dois-sabores.jpeg";
import imgBrigadeiros from "@/assets/produtos/brigadeiros-artesanais.webp";
import imgPrazerCamadas from "@/assets/produtos/prazer-em-camadas.webp";
import imgBrownie from "@/assets/produtos/brownie.webp";
import imgCopoMerengue from "@/assets/produtos/copo-merengue.webp";
import imgSurpresaUva from "@/assets/produtos/surpresa-uva.webp";
import imgNuvemOreo from "@/assets/produtos/nuvem-oreo-new.jpeg";
import imgCoxinhaBrigadeiro from "@/assets/produtos/coxinha-brigadeiro.webp";
import imgMorangoAmor from "@/assets/produtos/morango-do-amor.jpeg";
import imgEspetinhoUva from "@/assets/produtos/espetinho-uva.jpeg";
import imgBrigadeiroOreo from "@/assets/produtos/brigadeiro-oreo.jpeg";
import imgBrigadeiroNinhoOreo from "@/assets/produtos/brigadeiro-ninho-oreo.png";
import imgEspetinhoMorangoChoc from "@/assets/produtos/espetinho-morango-choc.png";
import imgEspetinhoMorangoNinho from "@/assets/produtos/espetinho-morango-ninho.jpeg";
import imgMorangoCravejadoTradicional from "@/assets/produtos/morango-cravejado-tradicional.jpeg";
import imgMorangoCravejadoMaracuja from "@/assets/produtos/morango-cravejado-maracuja.jpeg";

export type Flavor = {
  id: string;
  name: string;
  description: string;
  /** Preço opcional por sabor (sobrescreve o preço base do produto). */
  price?: number;
  /** Imagem opcional do sabor (usada em pickers de combo). */
  image?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image?: string;
  flavors?: Flavor[];
  flavorPicks?: { count: number; from: "copo" | "bombom" }[];
  unitLabel?: string;
  requiresScheduling?: boolean;
  minNoticeHours?: number;
  minQuantity?: number;
  suggestion?: boolean;
  badge?: string;
};

export type Category = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  products: Product[];
};

/* =========================================================
 * Sabores reaproveitados
 * ========================================================= */

export const COPO_FLAVORS: Flavor[] = [
  {
    id: "doce-encanto",
    name: "Doce Encanto — Brigadeiro, Ninho, Uva",
    description:
      "Brigadeiro cremoso, mousse de Ninho que parece nuvem e uvas que estouram na boca. Uma colherada e você entende o nome.",
    price: 34.99,
    image: imgDoceEncanto,
  },
  {
    id: "nevadinho",
    name: "Nevadinho — Mousse de Ninho & Ganache",
    description:
      "Mousse de Ninho aveludada com ganache de chocolate escorrendo por cima.",
    price: 30.9,
    image: imgNevadinho,
  },
  {
    id: "pecado-em-dobro",
    name: "Pecado em Dobro | Brigadeiro & Mousse de Ninho",
    description:
      "Brigadeiro + mousse de Ninho em camadas que se fundem na colher. Pecado assumido, sem arrependimento.",
    price: 30.9,
    image: imgNevadinho2,
  },
  {
    id: "prazer-em-camadas",
    name: "Prazer em Camadas — Brigadeiro Tradicional",
    description:
      "Brigadeiro no ponto perfeito com ganache brilhante. Chocolate puro, sem enrolação.",
    price: 30.9,
    image: imgPrazerCamadas,
  },
  {
    id: "copo-merengue",
    name: "Copo Merengue",
    description:
      "Creme branco sedoso, brigadeiro cremoso. Texturas que vão te surpreender.",
    price: 30.9,
    image: imgCopoMerengue,
  },
  {
    id: "doce-paixao",
    name: "Copo Doce Paixão — Brigadeiro, Ninho e Morango",
    description:
      "Brigadeiro, mousse de Ninho e morangos suculentos em camadas. O combo que virou vício.",
    price: 34.99,
    image: imgCopoConforto,
  },
];

export const BOMBOM_FLAVORS: Flavor[] = [
  {
    id: "uva-morango",
    name: "Bombom Dois Sabores — Uva e Morango",
    description:
      "Uvas e morangos frescos afundando em brigadeiro cremoso com ganache espelhada. Impossível comer devagar.",
    image: imgBombomMorango2,
  },
  {
    id: "ninho-uva",
    name: "Bombom no Copo — Mousse de Ninho e Uvas",
    description:
      "Mousse de Ninho aveludada abraçando uvas geladinhas. Leve, cremoso e viciante.",
    image: imgBombomUva,
  },
  {
    id: "ninho-morango",
    name: "Bombom Mousse de Ninho e Morango",
    description:
      "Mousse de Ninho com morangos suculentos e ganache. Cada colherada é uma surpresa.",
    image: imgBombomMorango,
  },
];

function p(
  id: string,
  name: string,
  price: number,
  image: string,
  extra: Partial<Product> = {},
): Product {
  return {
    id,
    name,
    price,
    description: extra.description ?? name,
    image,
    ...extra,
  };
}

/* =========================================================
 * Cardápio enxuto — fase de lançamento
 * ========================================================= */

export const CATEGORIES: Category[] = [
  {
    id: "sensacao",
    title: "Sensação do Momento",
    description: "",
    products: [
      p(
        "morango-cravejado-tradicional",
        "Morango Cravejado Tradicional",
        19.9,
        imgMorangoCravejadoTradicional,
        {
          description:
            "Morango fresco banhado no chocolate branco e cravejado com crocância. O clássico que conquista na primeira mordida.",
        },
      ),
      p(
        "morango-cravejado-maracuja",
        "Morango Cravejado de Maracujá",
        19.9,
        imgMorangoCravejadoMaracuja,
        {
          description:
            "Morango fresco banhado no chocolate branco com toque azedinho e crocante de maracujá. Uma explosão de sabores.",
        },
      ),
    ],
  },
  {
    id: "combos",
    title: "Combos",
    description: "",
    products: [
      p(
        "combo-doce-ritual",
        "Combo Conforto | 1 Copo da Felicidade + Camafeu",
        41.9,
        imgDoceRitual,
        {
          description:
            "Um copo recheado até a borda + um camafeu que derrete na primeira mordida. Ritual sagrado.",
          flavors: COPO_FLAVORS,
          originalPrice: 55.4,
          badge: "Economize R$ 13,50",
        },
      ),
      p(
        "combo-date-doce",
        "Combo Date Doce | 2 Copos da Felicidade",
        55.9,
        imgComboDateDoce,
        {
          description:
            "Dois copos, dois sabores, uma desculpa perfeita pra dividir com quem você ama — ou não.",
          flavorPicks: [{ count: 2, from: "copo" }],
          originalPrice: 70.0,
          badge: "Economize R$ 14,10",
        },
      ),
      p(
        "combo-experiencia-a-dois",
        "Experiência a Dois | 1 Copo + 1 Bombom no Copo + 2 Camafeus",
        85.5,
        imgExperienciaADois,
        {
          description:
            "O kit completo: copo, bombom no copo e dois camafeus. Pra noite ficar inesquecível.",
          flavorPicks: [
            { count: 1, from: "copo" },
            { count: 1, from: "bombom" },
          ],
          originalPrice: 103.9,
          badge: "Economize R$ 18,40",
        },
      ),
      p(
        "combo-3-camafeus",
        "3 Camafeus Artesanais",
        41.43,
        imgCamafeu,
        {
          description:
            "Três camafeus que somem antes de você perceber. Aviso dado.",
          originalPrice: 44.4,
          badge: "Economize R$ 2,97",
        },
      ),
    ],
  },
  {
    id: "copo",
    title: "Copo da Felicidade",
    description: "",
    badge: "⭐ Mais Vendido",
    products: [
      p("copo-doce-encanto", "Doce Encanto — Brigadeiro, Ninho, Uva", 28.9, imgDoceEncanto, {
        description:
          "280g de pura felicidade: brownie na base, brigadeiro cremoso, mousse de Ninho e uvas que estouram na boca.",
        originalPrice: 35.0,
        badge: "⭐ Mais Vendido",
      }),
      p("copo-nevadinho", "Nevadinho — Mousse de Ninho & Ganache", 28.9, imgNevadinho, {
        description:
          "280g com brownie na base, mousse de Ninho aveludada e ganache de chocolate escorrendo por cima.",
        originalPrice: 35.0,
      }),
      p(
        "copo-pecado-em-dobro",
        "Pecado em Dobro | Brigadeiro & Mousse de Ninho",
        28.9,
        imgNevadinho2,
        {
          description:
            "280g com brownie na base, brigadeiro e mousse de Ninho em camadas que se fundem na colher. Pecado assumido, sem arrependimento.",
          originalPrice: 35.0,
        },
      ),
      p(
        "copo-prazer-em-camadas",
        "Prazer em Camadas — Brigadeiro Tradicional",
        28.9,
        imgPrazerCamadas,
        {
          description:
            "280g com brownie na base, brigadeiro no ponto perfeito e ganache brilhante. Chocolate puro, sem enrolação.",
          originalPrice: 35.0,
        },
      ),
      p("copo-merengue", "Copo Merengue", 28.9, imgCopoMerengue, {
        description:
          "280g de creme branco sedoso, brigadeiro cremoso, morangos fresquinhos. Texturas que vão te surpreender.",
        originalPrice: 35.0,
      }),
      p(
        "copo-doce-paixao",
        "Copo Doce Paixão — Brigadeiro, Ninho e Morango",
        28.9,
        imgCopoConforto,
        {
          description:
            "280g com brownie na base, brigadeiro, mousse de Ninho e morangos suculentos em camadas. O combo que virou vício.",
          originalPrice: 35.0,
        },
      ),
    ],
  },
  {
    id: "bombom",
    title: "Bombom no Copo",
    description: "",
    products: [
      p("bombom-uva-morango", "Bombom Dois Sabores — Uva e Morango", 21.9, imgBombomMorango2, {
        description:
          "250g de uvas e morangos frescos afundando em brigadeiro cremoso com ganache espelhada. Impossível comer devagar.",
        originalPrice: 28.9,
      }),
      p("bombom-ninho-uva", "Bombom no Copo — Mousse de Ninho e Uvas", 21.9, imgBombomUva, {
        description:
          "250g de mousse de Ninho aveludada abraçando uvas geladinhas. Leve, cremoso e viciante.",
        originalPrice: 28.9,
      }),
      p("bombom-ninho-morango", "Bombom Mousse de Ninho e Morango", 21.9, imgBombomMorango, {
        description:
          "250g de mousse de Ninho com morangos suculentos e ganache. Cada colherada é uma surpresa.",
        originalPrice: 28.9,
      }),
    ],
  },
  {
    id: "artesanais",
    title: "Doces Artesanais",
    description: "",
    products: [
      p("art-brigadeiros", "Brigadeiros Artesanais", 15.0, imgBrigadeiros, {
        description:
          "Feitos um a um, enrolados à mão, com chocolate de verdade. Do jeitinho que brigadeiro tem que ser.",
        flavors: [
          { id: "brig-4-sortidos", name: "4 un. — Sortidos", description: "Caixa com 4 brigadeiros sortidos.", price: 15.0 },
          { id: "brig-4-trad", name: "4 un. — Tradicionais", description: "Caixa com 4 brigadeiros tradicionais.", price: 15.0 },
          { id: "brig-4-especiais", name: "4 un. — Especiais", description: "Caixa com 4 brigadeiros especiais da casa.", price: 15.0 },
          { id: "brig-4-beijinho", name: "4 un. — Beijinho", description: "Caixa com 4 beijinhos cremosos.", price: 15.0 },
          { id: "brig-10", name: "10 un. — Sortidos", description: "Caixa com 10 brigadeiros sortidos.", price: 27.0 },
          { id: "brig-15", name: "15 un. — Sortidos", description: "Caixa com 15 brigadeiros sortidos.", price: 37.5 },
        ],
      }),
      p("art-camafeu", "Camafeu de Morango", 14.8, imgCamafeu, {
        description:
          "Morango fresquinho envolto em creme branco aveludado e coberto com chocolate ao leite. Por fora chocolate, por dentro doçura que deixa saudade.",
        originalPrice: 20.0,
        flavors: [
          { id: "cam-morango-branco", name: "Morango com Creme Branco", description: "Camafeu de morango com creme branco aveludado.", price: 14.8 },
          { id: "cam-brig-trad", name: "Brigadeiro Tradicional", description: "Camafeu clássico com brigadeiro tradicional.", price: 14.8 },
        ],
      }),
      p("art-brownie", "Brownie", 13.0, imgBrownie, {
        description:
          "Casquinha craquelada, interior fudge que gruda no garfo. Com cobertura que transforma tudo.",
        flavors: [
          { id: "br-chocolatudo", name: "Brownie Chocolatudo", description: "Brownie irresistível feito com chocolate meio amargo, macio por dentro e com aquele sabor marcante que conquista na primeira mordida.", price: 13.0 },
          { id: "br-cob-brigadeiro", name: "Brownie com cobertura de brigadeiro", description: "Imagina aquele cheirinho de brownie saindo do forno… Crocante na medida certa, macio e super chocolatudo. Uma delícia que vai adoçar seu dia!", price: 16.5 },
          { id: "br-cob-brigadeiro-ninho", name: "Brownie com cobertura de brigadeiro Ninho", description: "Brownie chocolatudo coberto com brigadeiro de Ninho cremoso e morangos fresquinhos. Uma explosão de sabor em cada mordida!", price: 16.5 },
          { id: "br-cob-brigadeiro-amendoim", name: "Brownie com cobertura de brigadeiro e crocante de amendoim", description: "Brownie caseiro com cobertura cremosa de brigadeiro e toque crocante de amendoim.", price: 16.5 },
        ],
      }),
      p("gourmet-espetinho-uva-ninho", "Espetinho de Uva com Brigadeiro de Ninho e Cobertura de Chocolate", 20.0, imgEspetinhoUva, {
        description: "3 uvinhas, muito Ninho e o toque final de chocolate. Impossível comer só uma.",
      }),
      p("gourmet-espetinho-morango-ninho", "Espetinho de Morango com Brigadeiro de Ninho", 25.0, imgEspetinhoMorangoNinho, {
        description: "3 morangos + brigadeiro de Ninho + chocolate pra fechar com chave de ouro.",
      }),
      p("gourmet-brig-oreo", "Brigadeiro Gourmet Recheado com Bolacha Oreo", 9.99, imgBrigadeiroOreo, {
        description: "Brigadeiro gourmet com pedaços crocantes de Oreo explodindo no recheio.",
      }),
      p("gourmet-brig-ninho-oreo", "Brigadeiro de Ninho Recheado com Bolacha Oreo", 9.99, imgBrigadeiroNinhoOreo, {
        description: "Brigadeiro de Ninho cremoso com bolacha Oreo crocante. Explosão de sabores.",
      }),
      p("gourmet-coxinha-brigadeiro", "Coxinha de Brigadeiro — Escolha o Sabor", 14.0, imgCoxinhaBrigadeiro, {
        description: "Casquinha crocante, recheio cremoso de brigadeiro. Feita pra agradar todos os gostos.",
        flavors: [
          { id: "coxinha-tradicional", name: "Tradicional", description: "Coxinha de brigadeiro tradicional.", price: 14.0 },
          { id: "coxinha-ninho", name: "Ninho", description: "Coxinha de brigadeiro de Ninho.", price: 14.0 },
          { id: "coxinha-morango-amendoim", name: "Morango com Amendoim", description: "Coxinha de brigadeiro com morango e amendoim.", price: 14.0 },
        ],
      }),
      p("gourmet-espetinho-morango-choc", "Espetinho de Morango com Chocolate", 14.0, imgEspetinhoMorangoChoc, {
        description: "3 morangos fresquinhos banhados em chocolate de alta qualidade.",
      }),
      p("gourmet-morango-amor", "Morango do Amor com Creme Branco", 25.0, imgMorangoAmor, {
        description: "A crocância do caramelo, o azedinho do morango e a cremosidade do creme branco. Tudo na mesma mordida.",
      }),
      p("gourmet-nuvem-oreo", "Nuvem de Oreo", 9.9, imgNuvemOreo, {
        description: "Delicioso mousse cremoso de leite Ninho, super leve e aerado, combinado com pedaços crocantes de Oreo.",
      }),
    ],
  },
];

/* =========================================================
 * Delivery & contato
 * ========================================================= */

export const DELIVERY_FEES: Record<string, number> = {
  centro: 5,
  "vila nova": 7,
  "jardim américa": 8,
  "jardim america": 8,
  "bairro industrial": 10,
};

export function getDeliveryFee(neighborhood: string): number | null {
  const key = neighborhood.trim().toLowerCase();
  if (key in DELIVERY_FEES) return DELIVERY_FEES[key];
  return null;
}

export const OWNER_WHATSAPP = "5515998564202";
export const MIN_ORDER = 25;

export function getSuggestionProducts(): Product[] {
  const out: Product[] = [];
  for (const cat of CATEGORIES) {
    for (const p of cat.products) {
      if (p.suggestion) out.push(p);
    }
  }
  return out;
}
