import * as React from "react";
import { Inbox, Sparkle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — componente canônico para estados vazios.
 *
 * Substitui os padrões heterogêneos que existiam pelo app:
 *   - `text-slate-400` (Tailwind puro, fora do sistema)
 *   - `text-white/40` (opacidade ad-hoc, abaixo de WCAG AA)
 *   - texto solto sem ícone (admin)
 *   - `<tr><td colSpan>` com uma frase minúscula em cinza (visual
 *     de "tela quebrada")
 *
 * Todas as cores vêm de tokens semânticos (`muted-foreground`,
 * `border`, `card`, `primary`) — funciona em tema claro/escuro
 * sem ajuste.
 *
 * Duas variantes:
 *   - `default`: bloco autocontido (card/página) com borda
 *     tracejada.
 *   - `table`: renderiza `<tr><td colSpan>` para tabelas, com
 *     ilustração completa (halo concêntrico + sparkles) para
 *     não parecer que o layout quebrou.
 *
 * Uso:
 *   <EmptyState icon={Users} title="Nenhum cliente" description="..." />
 *   <EmptyState variant="table" colSpan={7} icon={Gift} title="…" />
 */

type Size = "sm" | "md" | "lg";

interface EmptyStateBaseProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: Size;
  className?: string;
  /** Desativa as sparkles decorativas (default: true na variante "table"). */
  decorative?: boolean;
}

interface EmptyStateBlockProps extends EmptyStateBaseProps {
  variant?: "default";
}

interface EmptyStateTableProps extends EmptyStateBaseProps {
  variant: "table";
  colSpan: number;
}

export type EmptyStateProps = EmptyStateBlockProps | EmptyStateTableProps;

const SIZE_MAP: Record<
  Size,
  { pad: string; icon: string; bubble: string; halo: string; title: string; desc: string; gap: string }
> = {
  sm: {
    pad: "py-8 px-4",
    icon: "h-6 w-6",
    bubble: "p-3",
    halo: "h-20 w-20",
    title: "text-sm",
    desc: "text-xs",
    gap: "gap-2",
  },
  md: {
    pad: "py-12 px-6",
    icon: "h-8 w-8",
    bubble: "p-4",
    halo: "h-28 w-28",
    title: "text-base",
    desc: "text-sm",
    gap: "gap-2.5",
  },
  lg: {
    pad: "py-16 px-8",
    icon: "h-10 w-10",
    bubble: "p-5",
    halo: "h-36 w-36",
    title: "text-lg",
    desc: "text-sm",
    gap: "gap-3",
  },
};

/**
 * Ilustração decorativa em camadas — anéis concêntricos suaves +
 * bubble com o ícone da tela. Coloca peso visual suficiente para
 * o vazio parecer intencional, sem competir com o conteúdo real.
 */
function EmptyIllustration({
  icon: Icon = Inbox,
  size,
  decorative,
}: {
  icon?: LucideIcon;
  size: Size;
  decorative: boolean;
}) {
  const s = SIZE_MAP[size];
  return (
    <div className={cn("relative grid place-items-center", s.halo)} aria-hidden>
      {/* Halo externo — anel tracejado sutil */}
      <div className="absolute inset-0 rounded-full border border-dashed border-border/50" />
      {/* Halo médio — gradiente radial com token primário */}
      <div
        className="absolute inset-[14%] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 22%, transparent), transparent 78%)",
        }}
      />
      {/* Bubble com o ícone */}
      <div
        className={cn(
          "relative grid place-items-center rounded-full border border-border/70 bg-muted/50 text-muted-foreground shadow-sm backdrop-blur-sm",
          s.bubble,
        )}
      >
        <Icon className={s.icon} strokeWidth={1.5} />
      </div>
      {/* Sparkles decorativas */}
      {decorative && (
        <>
          <Sparkle
            className="absolute -right-1 top-2 h-3 w-3 text-muted-foreground/60"
            strokeWidth={1.5}
          />
          <Sparkle
            className="absolute -left-1 bottom-3 h-2.5 w-2.5 text-muted-foreground/40"
            strokeWidth={1.5}
          />
        </>
      )}
    </div>
  );
}

function EmptyStateContent({
  icon,
  title,
  description,
  action,
  size = "md",
  decorative = true,
}: EmptyStateBaseProps) {
  const s = SIZE_MAP[size];
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center text-center", s.gap)}>
      <EmptyIllustration icon={icon} size={size} decorative={decorative} />
      <p className={cn("mt-1 font-semibold text-foreground", s.title)}>{title}</p>
      {description ? (
        <p className={cn("max-w-sm text-muted-foreground", s.desc)}>{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: EmptyStateProps) {
  const { icon, title, description, action, size = "md", className } = props;

  if (props.variant === "table") {
    const s = SIZE_MAP[size];
    return (
      <tr data-slot="empty-state-table-row">
        <td
          colSpan={props.colSpan}
          className={cn(
            // Fundo com grid pontilhado sutil para diferenciar o
            // vazio de uma linha comum sem parecer erro.
            "relative text-center",
            "before:pointer-events-none before:absolute before:inset-0 before:opacity-[0.35]",
            "before:[background-image:radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_1px,transparent_0)]",
            "before:[background-size:14px_14px]",
            s.pad,
            className,
          )}
          data-slot="empty-state-table"
        >
          <div className="relative">
            <EmptyStateContent
              icon={icon}
              title={title}
              description={description}
              action={action}
              size={size}
              decorative={props.decorative ?? true}
            />
          </div>
        </td>
      </tr>
    );
  }

  const s = SIZE_MAP[size];
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30",
        s.pad,
        className,
      )}
    >
      <EmptyStateContent
        icon={icon}
        title={title}
        description={description}
        action={action}
        size={size}
        decorative={props.decorative ?? false}
      />
    </div>
  );
}

export default EmptyState;
