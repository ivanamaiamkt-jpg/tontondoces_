import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/menu-data";

export function CategoryNav({ categories = CATEGORIES }: { categories?: Category[] }) {
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const navRef = useRef<HTMLDivElement>(null);


  // Observa qual seção está visível
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        // Pega a entrada mais "visível" (maior intersection ratio)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      {
        // Considera "ativo" o que está na faixa abaixo do header sticky
        rootMargin: "-160px 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    categories.forEach((cat) => {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el) observer.observe(el);
    });
    observers.push(observer);

    return () => observers.forEach((o) => o.disconnect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Auto-scroll horizontal do nav pra manter o item ativo visível
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeBtn = nav.querySelector<HTMLAnchorElement>(
      `a[data-cat-id="${activeId}"]`,
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    // Offset por causa do header + nav stickys (~140px)
    const top = el.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
      <div
        ref={navRef}
        className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((cat) => {
          const active = cat.id === activeId;
          return (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              data-cat-id={cat.id}
              onClick={(e) => handleClick(e, cat.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:text-primary"
              }`}
            >
              {cat.title}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
