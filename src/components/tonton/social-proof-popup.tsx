import { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

const NAMES = [
  "Marina", "Rafael", "Camila", "Júlia", "Pedro", "Beatriz", "Lucas",
  "Aline", "Bruna", "Carolina", "Diego", "Fernanda", "Gabriel", "Helena",
  "Isabela", "João", "Larissa", "Mateus", "Natália", "Otávio", "Paula",
  "Renata", "Tiago", "Vanessa",
];

const PRODUCTS = [
  "Doce Paixão",
  "Combo Date Doce",
  "Experiência a Dois",
  "3 Camafeus Artesanais",
  "Doce Encanto",
  "Nevadinho",
  "Pecado em Dobro",
  "Prazer em Camadas",
  "Copo Merengue",
  "Copo Doce Paixão",
  "Bombom Dois Sabores",
  "Bombom no Copo de Ninho e Uvas",
  "Bombom Mousse de Ninho e Morango",
  "Brigadeiros Artesanais",
  "Surpresa de Uva com Ninho",
  "Camafeu de Morango",
  "Brownie",
];

const CITIES = [
  "Vila Santa Rita",
  "Jardim Marco Antônio",
  "Jardim Sorocabano",
  "Vila Odim",
  "Jardim Santa Rosália",
  "Vila Adélia",
  "Vila Gabriel",
  "Retiro São Leopoldo",
  "Jardim Simus",
  "Jardim São Conrado",
  "Jardim Nogueira",
  "Jardim Camila",
  "Vila Santa Clara",
  "Jardim Aeroporto",
];

const TIMES = [
  "agora há pouco", "há 2 minutos", "há 5 minutos", "há 8 minutos", "há 12 minutos",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type Notice = {
  id: number;
  name: string;
  product: string;
  city: string;
  time: string;
};

export function SocialProofPopup() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let counter = 0;
    let hideTimeout: number | undefined;

    const show = () => {
      counter += 1;
      setNotice({
        id: counter,
        name: pick(NAMES),
        product: pick(PRODUCTS),
        city: pick(CITIES),
        time: pick(TIMES),
      });
      hideTimeout = window.setTimeout(() => setNotice(null), 5500);
    };

    // Primeiro aparece após 25s, depois a cada 60s (discreto, não fake)
    const first = window.setTimeout(show, 25000);
    const interval = window.setInterval(show, 60000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      if (hideTimeout) window.clearTimeout(hideTimeout);
    };
  }, []);

  if (!notice) return null;

  return (
    <div
      key={notice.id}
      className="pointer-events-auto fixed bottom-4 left-4 z-30 w-[calc(100%-2rem)] max-w-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingBag className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-foreground">
            <span className="font-semibold">{notice.name}</span> comprou{" "}
            <span className="font-semibold text-primary">{notice.product}</span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {notice.city} · {notice.time}
          </p>
        </div>
        <button
          onClick={() => setNotice(null)}
          aria-label="Fechar"
          className="text-muted-foreground/60 transition hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
