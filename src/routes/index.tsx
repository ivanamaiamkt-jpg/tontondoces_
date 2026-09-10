import { createFileRoute } from "@tanstack/react-router";
import { Heart, Instagram, MessageCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { CATEGORIES } from "@/lib/menu-data";
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
import tontonLogo from "@/assets/tonton-logo-light.png";

const CartDrawer = lazy(() =>
  import("@/components/tonton/cart-drawer").then((m) => ({ default: m.CartDrawer })),
);
const Testimonials = lazy(() =>
  import("@/components/tonton/testimonials").then((m) => ({ default: m.Testimonials })),
);
const SocialProofPopup = lazy(() =>
  import("@/components/tonton/social-proof-popup").then((m) => ({ default: m.SocialProofPopup })),
);

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: heroCups, fetchpriority: "high" } as any,
    ],
  }),
});

function HomePage() {
  const { cartOpen } = useOrder();
  return (
    <div className="min-h-screen bg-background">
      <PauseBanner />
      {/* Hero — duas colunas lado a lado */}
      <section className="hero-tonton w-full flex relative overflow-hidden">
        <div className="hero-tonton-bg">
          <img
            src={heroCups}
            alt=""
            aria-hidden="true"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
          <div className="hero-tonton-bg-overlay" />
        </div>
        <div className="hero-tonton-left">
          <img
            src={tontonLogo}
            alt="TonTon Doces"
            className="hero-tonton-logo"
          />
          <h2 className="hero-tonton-title">
            Brigadeiros absurdamente cremosos entregues na sua porta
          </h2>
          <p className="hero-tonton-sub">📍 Sorocaba e região</p>

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
            style={{ color: "#5c1f5c", display: "inline-flex", alignItems: "center" }}
          >
            <MessageCircle size={16} strokeWidth={2.2} />
          </a>
          <a
            href="https://instagram.com/tontondoces_"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @tontondoces"
            style={{ color: "#5c1f5c", display: "inline-flex", alignItems: "center" }}
          >
            <Instagram size={16} strokeWidth={2.2} />
          </a>
          <span aria-hidden>·</span>
          <span>🛒 Pedido mínimo: R$25,00</span>
        </div>
      </section>

      {/* Nav sticky de categorias */}
      <CategoryNav />

      <ReorderCard />

      {/* Menu */}
      <main id="cardapio" className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:py-14">
        {CATEGORIES.map((cat, idx) => (
          <section
            key={cat.id}
            id={`cat-${cat.id}`}
            className="scroll-mt-32 space-y-4"
          >
            <CategoryBanner title={cat.title} />
            <LazyOnVisible eager={idx === 0} minHeight={cat.products.length * 180}>
              <div className="space-y-3">
                {cat.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </LazyOnVisible>
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
            href="https://instagram.com/tontondoces"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20"
          >
            <Instagram className="h-5 w-5" />
          </a>
        </div>
      </footer>

      {cartOpen && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
      <CartFab />
      <Suspense fallback={null}>
        <SocialProofPopup />
      </Suspense>
    </div>
  );
}
