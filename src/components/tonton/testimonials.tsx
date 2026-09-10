import { Star } from "lucide-react";

type Testimonial = {
  name: string;
  text: string;
  timeAgo: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Gabriela Motta",
    timeAgo: "1 mês atrás",
    text: "Que doces maravilhosos!! Além de um atendimento impecável! Se tornou com certeza nossa preferência naquele momento que precisamos tanto de um docinho! Eu e meu marido nos apaixonamos por todos! Que Deus abençoe imensamente vocês.",
  },
  {
    name: "Clayton C. Silva",
    timeAgo: "9 meses atrás",
    text: "Olha, nunca fui chegado nesse tipo de doce, mas esse é bom demais. Recomendo muito... Tanto o de brigadeiro quanto de creme branco. O de maracujá é bem peculiar, quem prefere frutas cítricas vai gostar da combinação.",
  },
  {
    name: "Bruno Rodrigues Gonçalves",
    timeAgo: "1 ano atrás",
    text: "Os melhores doces e brigadeiros que já comi, podem pedir sem medo.",
  },
  {
    name: "Luiz",
    timeAgo: "9 meses atrás",
    text: "Muito bom os doces! Muito bem feito e uma delícia, ingredientes de qualidade!",
  },
  {
    name: "Marilene Leal",
    timeAgo: "9 meses atrás",
    text: "Doces perfeitos e de qualidade de primeira! Recomendo.",
  },
];

// Logo oficial do Google em SVG (cores originais)
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 272 92" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#EA4335"
        d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#FBBC05"
        d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#4285F4"
        d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"
      />
      <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z" />
      <path
        fill="#EA4335"
        d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
      />
      <path
        fill="#4285F4"
        d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
      />
    </svg>
  );
}

export function Testimonials() {
  return (
    <section className="border-t border-border/60 bg-muted/30 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <h2 className="font-display text-xl font-light text-primary sm:text-2xl">
            O que dizem
          </h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Avaliações no
            </span>
            <GoogleLogo className="h-3.5 w-auto" />
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <li
              key={i}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-foreground">
                  {t.name}
                </p>
                <GoogleLogo className="h-3 w-auto opacity-80" />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-gold" />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">{t.timeAgo}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                "{t.text}"
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
