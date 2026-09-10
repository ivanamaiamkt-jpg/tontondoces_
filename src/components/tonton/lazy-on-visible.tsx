import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renderiza children somente quando o placeholder entra (ou está perto de entrar)
 * no viewport. Mantém uma altura mínima pra não causar layout shift.
 */
export function LazyOnVisible({
  children,
  minHeight = 300,
  rootMargin = "400px",
  eager = false,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={!visible ? { minHeight } : undefined}>
      {visible ? children : null}
    </div>
  );
}
