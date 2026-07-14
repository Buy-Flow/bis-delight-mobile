import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — componente canônico para estados vazios.
 *
 * Substitui os padrões heterogêneos que existiam pelo app:
 *   - `text-slate-400` (Tailwind puro, fora do sistema)
 *   - `text-white/40` (opacidade ad-hoc, abaixo de WCAG AA)
 *   - texto solto sem ícone (admin)
 *
 * Todas as cores vêm de tokens semânticos (`muted-foreground`,
 * `border`, `card`) — funciona em tema claro/escuro sem ajuste.
 *
 * Duas variantes:
 *   - `default`: bloco autocontido (card/página)
 *   - `table`: já renderiza `<tr><td colSpan={n}>` para tabelas
 *
 * Uso:
 *   <EmptyState icon={Users} title="Nenhum cliente" description="..." />
 *   <EmptyState variant="table" colSpan={7} title="Nenhum item." />
 */

type Size = "sm" | "md" | "lg";

interface EmptyStateBaseProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: Size;
  className?: string;
}

interface EmptyStateBlockProps extends EmptyStateBaseProps {
  variant?: "default";
}

interface EmptyStateTableProps extends EmptyStateBaseProps {
  variant: "table";
  colSpan: number;
}

export type EmptyStateProps = EmptyStateBlockProps | EmptyStateTableProps;

const SIZE_MAP: Record<Size, { pad: string; icon: string; title: string; desc: string; gap: string }> = {
  sm: { pad: "py-6 px-4", icon: "h-6 w-6", title: "text-sm", desc: "text-xs", gap: "gap-1.5" },
  md: { pad: "py-10 px-6", icon: "h-9 w-9", title: "text-base", desc: "text-sm", gap: "gap-2" },
  lg: { pad: "py-16 px-8", icon: "h-12 w-12", title: "text-lg", desc: "text-sm", gap: "gap-3" },
};

function EmptyStateContent({
  icon: Icon = Inbox,
  title,
  description,
  action,
  size = "md",
}: EmptyStateBaseProps) {
  const s = SIZE_MAP[size];
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center text-center", s.gap)}>
      <div
        aria-hidden
        className="grid place-items-center rounded-full border border-border/60 bg-muted/40 p-3 text-muted-foreground"
      >
        <Icon className={s.icon} strokeWidth={1.5} />
      </div>
      <p className={cn("font-semibold text-foreground", s.title)}>{title}</p>
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
      <tr>
        <td
          colSpan={props.colSpan}
          className={cn("text-center", s.pad, className)}
          data-slot="empty-state-table"
        >
          <EmptyStateContent
            icon={icon}
            title={title}
            description={description}
            action={action}
            size={size}
          />
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
      />
    </div>
  );
}

export default EmptyState;
