import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "none";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  distance = 24,
  duration = 700,
  once = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  distance?: number;
  duration?: number;
  once?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Se o elemento já estiver visível no primeiro paint (above-the-fold),
  // marca como visível de forma síncrona para evitar o "flash" de conteúdo
  // aparecendo em pedaços no carregamento inicial.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);


  const offset =
    direction === "up"
      ? `translate3d(0, ${distance}px, 0)`
      : direction === "down"
        ? `translate3d(0, -${distance}px, 0)`
        : direction === "left"
          ? `translate3d(${distance}px, 0, 0)`
          : direction === "right"
            ? `translate3d(-${distance}px, 0, 0)`
            : "translate3d(0,0,0)";

  const style: React.CSSProperties = {
    transform: visible ? "translate3d(0,0,0)" : offset,
    opacity: visible ? 1 : 0,
    transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity ${duration}ms ease ${delay}ms`,
    willChange: "transform, opacity",
  };

  const Comp = Tag as unknown as React.ElementType;
  return (
    <Comp
      ref={ref as unknown as React.Ref<HTMLElement>}
      className={cn(className)}
      style={style}
    >
      {children}
    </Comp>
  );
}
