import { useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useIsAdmin } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

type AdminTab = "products" | "categories" | "highlights" | "extras" | "news" | "settings";

export function AdminEditButton({
  tab,
  edit,
  label = "Editar no painel",
  className,
  size = "md",
}: {
  tab: AdminTab;
  edit?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  if (!isAdmin) return null;

  const dims = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigate({ to: "/admin", search: { tab, edit } });
      }}
      aria-label={label}
      className={cn(
        "z-30 grid place-items-center rounded-full border border-neon-cyan/40 bg-black/60 text-neon-cyan backdrop-blur transition hover:bg-neon-cyan hover:text-black active:scale-95",
        dims,
        className,
      )}
    >
      <Pencil className={icon} strokeWidth={2.5} />
    </button>
  );
}
