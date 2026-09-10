import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Calculator,
  Truck,
  Users,
  ShoppingCart,
  Settings,
  LogOut,
  Heart,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel TonTon" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    // não aplicar guard na própria página de login
    if (location.pathname === "/admin/login") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/admin/login", search: { redirect: location.pathname } });
    }
    // checa role admin
    const { data: roles } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = (roles as Array<{ role: string }> | null)?.some(
      (r) => r.role === "admin",
    );
    if (!isAdmin) {
      throw redirect({ to: "/admin/login", search: { redirect: location.pathname } });
    }
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/admin/calculadora", label: "Calculadora", icon: Calculator },
  { to: "/admin/taxas", label: "Taxas de entrega", icon: Truck },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/abandonados", label: "Abandonados", icon: ShoppingCart },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-primary text-primary" />
          <span className="font-display text-lg">TonTon Admin</span>
        </Link>
        <button
          onClick={() => setOpenMobile((v) => !v)}
          className="rounded-md border border-border px-3 py-1 text-sm"
        >
          {openMobile ? "Fechar" : "Menu"}
        </button>
      </header>

      <div className="lg:flex">
        {/* Sidebar */}
        <aside
          className={`${
            openMobile ? "block" : "hidden"
          } border-b border-border bg-background lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:border-b-0 lg:border-r`}
        >
          <div className="hidden items-center gap-2 border-b border-border px-5 py-5 lg:flex">
            <Heart className="h-6 w-6 fill-primary text-primary" />
            <div>
              <p className="font-display text-lg leading-tight">TonTon Admin</p>
              <p className="text-xs text-muted-foreground">Painel da loja</p>
            </div>
          </div>
          <nav className="space-y-0.5 p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? path === item.to
                : path === item.to || path.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to as "/admin"}
                  onClick={() => setOpenMobile(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <p className="truncate px-2 text-xs text-muted-foreground">{email}</p>
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
