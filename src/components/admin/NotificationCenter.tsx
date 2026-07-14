import { useSyncExternalStore, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, Trash2, ShoppingBag, CreditCard, Truck, PackageCheck, XCircle, Star, AlertTriangle, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  subscribeAdminNotifs,
  getAdminNotifs,
  markAllRead,
  markRead,
  clearAdminNotifs,
  type AdminNotif,
  type AdminNotifKind,
} from "@/lib/admin-notifications";

const ICONS: Record<AdminNotifKind, { icon: typeof Bell; color: string }> = {
  order_new: { icon: ShoppingBag, color: "text-neon-yellow" },
  order_paid: { icon: CreditCard, color: "text-emerald-400" },
  order_dispatched: { icon: Truck, color: "text-neon-cyan" },
  order_delivered: { icon: PackageCheck, color: "text-emerald-300" },
  order_cancelled: { icon: XCircle, color: "text-red-400" },
  order_late: { icon: Clock, color: "text-amber-400" },
  review_new: { icon: Star, color: "text-amber-300" },
  stock_low: { icon: AlertTriangle, color: "text-orange-400" },
  system: { icon: Bell, color: "text-white/70" },
};

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function NotificationCenter() {
  const notifs = useSyncExternalStore(
    subscribeAdminNotifs,
    getAdminNotifs,
    getAdminNotifs,
  );
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = notifs.filter((n) => !n.read).length;

  const go = (n: AdminNotif) => {
    markRead(n.id);
    setOpen(false);
    if (n.href) {
      // Support "/path?order=..." with search
      const [path, qs] = n.href.split("?");
      const search: Record<string, string> = {};
      if (qs) {
        for (const kv of qs.split("&")) {
          const [k, v] = kv.split("=");
          if (k) search[k] = decodeURIComponent(v ?? "");
        }
      }
      navigate({ to: path as never, search: search as never });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/90 transition hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-black leading-[18px] text-black shadow-[0_0_10px_theme(colors.pink.500)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] border-white/10 bg-[#170a2e] p-0 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-neon-yellow" />
            <span className="text-sm font-bold">Notificações</span>
            {unread > 0 && (
              <span className="rounded-full bg-neon-pink/20 px-2 py-0.5 text-[10px] font-bold text-neon-pink">
                {unread} nova{unread === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              title="Marcar tudo como lido"
              className="grid h-7 w-7 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={clearAdminNotifs}
              disabled={notifs.length === 0}
              title="Limpar tudo"
              className="grid h-7 w-7 place-items-center rounded-md text-white/60 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-white/40">
              <Bell className="h-8 w-8 opacity-40" />
              <div className="text-sm">Nenhuma notificação por enquanto.</div>
              <div className="text-[11px] text-white/30">
                Novos pedidos, pagamentos, atrasos, avaliações e alertas de estoque aparecem aqui.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifs.map((n) => {
                const meta = ICONS[n.kind] ?? ICONS.system;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-white/5",
                        !n.read && "bg-white/[0.03]",
                      )}
                    >
                      <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5", meta.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("truncate text-sm", n.read ? "text-white/70" : "font-semibold text-white")}>
                            {n.title}
                          </span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-pink" />}
                        </div>
                        {n.description && (
                          <div className="truncate text-[11px] text-white/50">{n.description}</div>
                        )}
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/30">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
