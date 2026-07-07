import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "none";

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
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
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
