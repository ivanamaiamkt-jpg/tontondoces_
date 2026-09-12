import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/menu-data";
import { getSoldOutProductIds, setProductAvailability } from "@/lib/product-availability";
import { brl } from "@/lib/format";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cardapio")({
  component: CardapioAdminPage,
});

function CardapioAdminPage() {
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setSoldOut(await getSoldOutProductIds());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (productId: string, currentlySoldOut: boolean) => {
    setPending(productId);
    const { error } = await setProductAvailability(productId, currentlySoldOut);
    setPending(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(currentlySoldOut ? "Marcado como disponível" : "Marcado como esgotado");
      load();
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Cardápio</h1>
        <p className="text-sm text-muted-foreground">
          Marque um item como esgotado quando faltar ingrediente ou estoque — ele some do botão
          de pedir na hora pro cliente. Nome, preço, descrição e fotos ficam no código (fala comigo
          pra mudar esses).
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        CATEGORIES.map((cat) => (
          <section key={cat.id} className="mb-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-xl">{cat.title}</h2>
            <ul className="divide-y divide-border">
              {cat.products.map((p) => {
                const isSoldOut = soldOut.has(p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className={`min-w-0 flex-1 ${isSoldOut ? "opacity-50" : ""}`}>
                      <p className="truncate font-medium text-foreground">
                        {p.name}
                        {isSoldOut && (
                          <span className="ml-2 text-xs font-semibold uppercase text-destructive">
                            Esgotado
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <p className="shrink-0 font-display text-base text-primary">
                      {brl(p.price)}
                    </p>
                    <button
                      onClick={() => toggle(p.id, isSoldOut)}
                      disabled={pending === p.id}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
                    >
                      {isSoldOut ? (
                        <>
                          <Eye className="h-4 w-4" /> Marcar disponível
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4" /> Marcar esgotado
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
