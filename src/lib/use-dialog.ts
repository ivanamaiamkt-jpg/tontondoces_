// Comportamento de janela (carrinho, checkout, cadastro): foco entra ao abrir, Tab não escapa pra
// página de trás, Esc fecha e o foco volta pra quem abriu. Com janelas empilhadas, só a de cima reage.
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const stack: HTMLElement[] = [];

function visibleFocusables(node: HTMLElement) {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  );
}

export function useDialogA11y<T extends HTMLElement>(open: boolean, onEscape?: () => void) {
  const ref = useRef<T>(null);
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(node);

    // Foco inicial: campo marcado com data-autofocus; senão o próprio painel.
    const target = node.querySelector<HTMLElement>("[data-autofocus]") ?? node;
    if (target === node && !node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== node) return;
      if (e.key === "Escape") {
        if (escRef.current) {
          e.stopPropagation();
          escRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = visibleFocusables(node);
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !node.contains(active) || active === node) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.lastIndexOf(node);
      if (i >= 0) stack.splice(i, 1);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
