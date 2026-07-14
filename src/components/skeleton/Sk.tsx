import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes } from "react";

type SkVariant = "shimmer" | "pulse" | "wave" | "static";

export interface SkProps extends HTMLAttributes<HTMLDivElement> {
  /** Override variant per element (defaults to global setting). */
  variant?: SkVariant;
  /** Delay in ms (used for stagger effects). */
  delay?: number;
  /** Radius override (px). */
  radius?: number | string;
}

/**
 * Base skeleton primitive. Reads global CSS variables set by
 * SkeletonProvider (--sk-radius, --sk-speed, --sk-base, --sk-shine).
 * Use variant classes to override animation type per element.
 */
export function Sk({ className, variant, delay, radius, style, ...rest }: SkProps) {
  const s: CSSProperties = { ...style };
  if (delay) s.animationDelay = `${delay}ms`;
  if (radius !== undefined) s.borderRadius = typeof radius === "number" ? `${radius}px` : radius;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "sk",
        variant === "pulse" && "sk--pulse",
        variant === "wave" && "sk--wave",
        variant === "static" && "sk--static",
        className,
      )}
      style={s}
      {...rest}
    />
  );
}

/** Circular skeleton (avatars, icons). */
export function SkCircle({ size = 40, className, ...rest }: SkProps & { size?: number }) {
  return (
    <Sk
      {...rest}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size, borderRadius: "9999px", ...(rest.style ?? {}) }}
    />
  );
}

/** Multi-line text block skeleton. */
export function SkText({
  lines = 3,
  className,
  variant,
  lastWidth = "70%",
}: {
  lines?: number;
  className?: string;
  variant?: SkVariant;
  lastWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Sk
          key={i}
          variant={variant}
          delay={i * 50}
          className="h-3"
          style={{ width: i === lines - 1 ? lastWidth : "100%", borderRadius: "999px" }}
        />
      ))}
    </div>
  );
}
