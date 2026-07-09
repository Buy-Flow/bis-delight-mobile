import { useState } from "react";
import { User as UserIcon, LogOut, Award, Heart, ClipboardList, Shield, Users, LineChart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/use-auth";
import { useIsAdmin } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

export function AccountButton() {
  const { user, isAuthenticated } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => navigate({ to: "/auth" })}
        aria-label="Entrar"
        className="grid h-11 w-11 place-items-center rounded-2xl card-acai text-neon-cyan active:scale-95 transition"
      >
        <UserIcon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Minha conta"
        className="grid h-11 w-11 place-items-center rounded-2xl card-acai text-neon-cyan active:scale-95 transition"
      >
        <UserIcon className="h-5 w-5" />
      </button>


      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.14_0.09_305)]/95 backdrop-blur-md shadow-2xl",
            )}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <div className="truncate text-sm font-bold text-white">
                {user?.user_metadata?.full_name || "Cliente Bis"}
              </div>
              <div className="truncate text-[11px] text-white/50">{user?.email}</div>
            </div>

            <MenuItem
              icon={ClipboardList}
              label="Meus pedidos"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/conta", search: { tab: "pedidos" } as never });
              }}
            />
            <MenuItem
              icon={Award}
              label="Bis Recompensa"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/conta", search: { tab: "fidelidade" } as never });
              }}
            />
            <MenuItem
              icon={Heart}
              label="Meus favoritos"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/conta", search: { tab: "favoritos" } as never });
              }}
            />
            <MenuItem
              icon={UserIcon}
              label="Perfil"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/conta", search: { tab: "perfil" } as never });
              }}
            />
            {isAdmin && (
              <div className="border-t border-white/10">
                <MenuItem
                  icon={Shield}
                  label="Painel Administrador"
                  accent
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/admin" });
                  }}
                />
                <MenuItem
                  icon={ClipboardList}
                  label="Pedidos"
                  accent
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/pedidos" });
                  }}
                />
                <MenuItem
                  icon={LineChart}
                  label="Financeiro"
                  accent
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/financeiro" });
                  }}
                />
                <MenuItem
                  icon={Users}
                  label="Clientes"
                  accent
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/clientes" });
                  }}
                />

              </div>
            )}

            <div className="border-t border-white/10">
              <MenuItem
                icon={LogOut}
                label="Sair"
                danger
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  accent,
}: {
  icon: typeof UserIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/5",
        danger ? "text-red-300" : accent ? "text-neon-yellow font-semibold" : "text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
