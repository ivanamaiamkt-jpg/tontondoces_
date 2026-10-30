import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Instagram, MessageCircle } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/menu-data";
import { getAvailabilityState } from "@/lib/product-availability";
import { getMergedCategories } from "@/lib/menu-overrides";
import { useMinOrder } from "@/lib/min-order";
import { useDeliverySettings } from "@/lib/delivery";
import { useGiftMin } from "@/lib/gift";
import { brl } from "@/lib/format";
import { CategoryBanner } from "@/components/tonton/category-banner";
import { ProductCard } from "@/components/tonton/product-card";
import { CategoryNav } from "@/components/tonton/category-nav";
import { CartFab } from "@/components/tonton/cart-fab";
import { LazyOnVisible } from "@/components/tonton/lazy-on-visible";
import { StoreHoursLabel } from "@/components/tonton/store-hours-label";
import { ReorderCard } from "@/components/tonton/reorder-card";
import { PauseBanner } from "@/components/tonton/pause-banner";
import { useOrder } from "@/contexts/order-context";
import heroCups from "@/assets/hero-cups-photo.webp";
import tontonLogo from "@/assets/tonton-logo-light.webp";

const CartDrawer = lazy(() =>
  import("@/components/tonton/cart-drawer").then((m) => ({ default: m.CartDrawer })),
);
const Testimonials = lazy(() =>
  import("@/components/tonton/testimonials").then((m) => ({ default: m.Testimonials })),
);

export const Route = createFileRoute("/")({
  component: HomePage,
  // Esgotados e arquivados já vêm resolvidos no HTML, pra um produto arquivado
  // nunca aparecer nem por um instante. Se o banco demorar, segue sem eles.
  loader: async () => {
    try {
      const state = await Promise.race([
        getAvailabilityState(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      return {
        soldOut: state ? [...state.soldOut] : [],
        archived: state ? [...state.archived] : [],
      };
    } catch {
      return { soldOut: [] as string[], archived: [] as string[] };
    }
  },
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: heroCups, fetchPriority: "high" } as any,
    ],
  }),
});

function HomePage() {
  const { cartOpen, items } = useOrder();
  const minOrder = useMinOrder();
  const delivery = useDeliverySettings();
  const giftMin = useGiftMin();
  const initial = Route.useLoaderData();
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set(initial.soldOut));
  const [archived, setArchived] = useState<Set<string>>(() => new Set(initial.archived));
  const [merged, setMerged] = useState<Category[]>(CATEGORIES);

  useEffect(() => {
    // Se a consulta falhar (rede ruim), mantém o que já veio no HTML em vez de zerar tudo.
    getAvailabilityState().then((s) => {
      if (!s) return;
      setSoldOut(s.soldOut);
      setArchived(s.archived);
    });
    getMergedCategories().then(setMerged);
  }, []);

  const categories = useMemo(
    () =>
      merged
        .map((c) => ({ ...c, products: c.products.filter((p) => !archived.has(p.id)) }))
        .filter((c) => c.products.length > 0),
    [merged, archived],
  );

  return (
    <div className={`min-h-screen bg-background ${items.length > 0 && !cartOpen ? "pb-24" : ""}`}>
      <a
        href="#cardapio"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Ir para o cardápio
      </a>
      <PauseBanner />
      {/* Hero — duas colunas lado a lado */}
      <section className="hero-tonton w-full flex relative overflow-hidden">
        <div className="hero-tonton-left">
          <img
            src={tontonLogo}
            alt="TonTon Doces"
            className="hero-tonton-logo"
          />
          <h1 className="hero-tonton-title">
            {delivery.enabled
              ? "Brigadeiros absurdamente cremosos, na sua porta ou prontinhos pra você buscar"
              : "Brigadeiros absurdamente cremosos, prontinhos pra você buscar"}
          </h1>
        </div>
        <div className="hero-tonton-right">
          <img
            src={heroCups}
            alt="Copos da Felicidade — TonTon Doces"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
        </div>
      </section>

      {/* Promo bar */}
      <section
        className="text-center"
        style={{
          backgroundColor: "#f5e6c8",
          padding: "14px 24px",
          borderBottom: "1px solid rgba(92,31,92,0.08)",
        }}
      >
        <div
          style={{
            fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
            fontSize: "12px",
            color: "#5c1f5c",
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <StoreHoursLabel />
          <span aria-hidden>·</span>
          <a
            href="https://wa.me/5515998564202"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Fale no WhatsApp"
            className="-my-3 inline-flex h-11 w-11 items-center justify-center"
            style={{ color: "#5c1f5c" }}
          >
            <MessageCircle size={18} strokeWidth={2.2} />
          </a>
          <a
            href="https://instagram.com/tontondoces_"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @tontondoces_"
            className="-my-3 inline-flex h-11 w-11 items-center justify-center"
            style={{ color: "#5c1f5c" }}
          >
            <Instagram size={18} strokeWidth={2.2} />
          </a>
          <span aria-hidden>·</span>
          <span>🛒 Pedido mínimo: {brl(minOrder)}</span>
          {giftMin > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>
                Pedidos a partir de {Number.isInteger(giftMin) ? `R$ ${giftMin}` : brl(giftMin)} ganham
                um brinde 🎁
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <Link
            to="/meus-pedidos"
            className="-my-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
            style={{ color: "#5c1f5c" }}
          >
            Meus pedidos
          </Link>
        </div>
      </section>

      {/* Nav sticky de categorias */}
      <CategoryNav categories={categories} />

      <ReorderCard />

      {/* Menu */}
      <main id="cardapio" className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:py-14">
        {categories.map((cat) => (
          <section
            key={cat.id}
            id={`cat-${cat.id}`}
            className="scroll-mt-16 space-y-4"
          >
            <CategoryBanner title={cat.title} />
            {/* Todas as categorias vêm prontas (as fotos já carregam só quando chegam perto):
                antes elas montavam ao rolar e a página dava um salto. */}
            <div className="space-y-3">
              {cat.products.map((p) => (
                <ProductCard key={p.id} product={p} soldOut={soldOut.has(p.id)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Depoimentos reais */}
      <LazyOnVisible minHeight={400}>
        <Suspense fallback={null}>
          <Testimonials />
        </Suspense>
      </LazyOnVisible>

      {/* Footer */}
      <footer className="border-t border-border bg-primary py-10 text-center text-primary-foreground">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-gold">
          TonTon Doces
        </p>
        <p className="mt-2 font-display text-2xl">Feito com muito amor 💕</p>
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-primary-foreground/70">
          <Heart className="h-3 w-3 fill-gold text-gold" /> Doceria artesanal
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <a
            href="https://wa.me/5515998564202"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
          <a
            href="https://instagram.com/tontondoces_"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @tontondoces_"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20"
          >
            <Instagram className="h-5 w-5" />
          </a>
        </div>
        <Link
          to="/meus-pedidos"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary-foreground/80 underline underline-offset-2 hover:text-primary-foreground"
        >
          Meus pedidos
        </Link>
      </footer>

      {cartOpen && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
      <CartFab />
    </div>
  );
}
