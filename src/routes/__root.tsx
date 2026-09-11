import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";

import { OrderProvider } from "@/contexts/order-context";
import { CustomerCaptureModal } from "@/components/tonton/customer-capture-modal";
import { registerServiceWorker } from "@/lib/pwa";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TonTon Doces — Doceria Artesanal" },
      { name: "description", content: "Copo da Felicidade, Bombom no Copo e mais delícias artesanais. Peça pelo cardápio online da TonTon Doces." },
      { property: "og:title", content: "TonTon Doces — Doceria Artesanal" },
      { property: "og:description", content: "Copo da Felicidade, Bombom no Copo e mais delícias artesanais. Peça pelo cardápio online da TonTon Doces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TonTon Doces — Doceria Artesanal" },
      { name: "twitter:description", content: "Copo da Felicidade, Bombom no Copo e mais delícias artesanais. Peça pelo cardápio online da TonTon Doces." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ee6b671-b1f0-47b0-89ae-c6276431161d/id-preview-29089fe1--1cf8a7bc-7b17-4363-866f-43d68419730a.lovable.app-1777154510053.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ee6b671-b1f0-47b0-89ae-c6276431161d/id-preview-29089fe1--1cf8a7bc-7b17-4363-866f-43d68419730a.lovable.app-1777154510053.png" },
      { name: "theme-color", content: "#5c1f5c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TonTon Doces" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://nominatim.openstreetmap.org" },
      { rel: "preconnect", href: "https://viacep.com.br" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','902455499492362');fbq('track','PageView');fbq('track','ViewContent');`,
      },
      {
        children: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wngepph1g8");`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=902455499492362&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return (
    <OrderProvider>
      <Outlet />
      <CustomerCaptureModal />
      <Toaster richColors position="top-center" />
    </OrderProvider>
  );
}
