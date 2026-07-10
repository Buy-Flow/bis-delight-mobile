import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, ExternalLink, Sparkles, ArrowRight, X } from "lucide-react";
import notifMascot from "@/assets/notif-mascot.png.asset.json";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useUnreadNotifications } from "./NotificationsInbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { applyNotifTokens, useNotifVars } from "@/lib/notif-tokens";

type Campaign = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  url: string | null;
  created_at: string;
  expires_at?: string | null;
};


type Delivery = {
  id: string;
  opened_at: string | null;
  created_at: string;
  campaign_id: string;
  campaign: Campaign | Campaign[] | null;
};

type Item = {
  deliveryIds: string[];
  latest: string;
  campaign: Campaign;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationsBell() {
  const { isAuthenticated, user } = useAuth();
  const unread = useUnreadNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const notifVars = useNotifVars();

  const loadUnread = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("push_deliveries")
      .select("id, opened_at, created_at, campaign_id, campaign:push_campaigns(id, title, body, image, url, created_at, expires_at)")
      .is("opened_at", null)
      .order("created_at", { ascending: false })
      .limit(30);

    const rows = (data ?? []) as Delivery[];
    const now = Date.now();
    const map = new Map<string, Item>();
    for (const d of rows) {
      const c = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
      if (!c) continue;
      if (c.expires_at && new Date(c.expires_at).getTime() <= now) continue;
      const prev = map.get(d.campaign_id);
      if (prev) {
        prev.deliveryIds.push(d.id);
        if (d.created_at > prev.latest) prev.latest = d.created_at;
      } else {
        map.set(d.campaign_id, { deliveryIds: [d.id], latest: d.created_at, campaign: c });
      }
    }
    setItems(Array.from(map.values()).sort((a, b) => (a.latest < b.latest ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const markAllRead = async () => {
    const ids = items.flatMap((i) => i.deliveryIds);
    if (!ids.length) return;
    await supabase
      .from("push_deliveries")
      .update({ opened_at: new Date().toISOString() })
      .in("id", ids)
      .is("opened_at", null);
    setItems([]);
  };

  const openItem = async (item: Item) => {
    await supabase
      .from("push_deliveries")
      .update({ opened_at: new Date().toISOString() })
      .in("id", item.deliveryIds)
      .is("opened_at", null);
    setItems((prev) => prev.filter((i) => i.campaign.id !== item.campaign.id));
    const url = item.campaign.url;
    if (url) {
      if (url.startsWith("http")) window.open(url, "_blank");
      else {
        setOpen(false);
        window.location.href = url;
      }
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          className="relative grid h-11 w-11 place-items-center rounded-2xl card-acai text-neon-cyan active:scale-95 transition"
        >
          <img
            src={notifMascot.url}
            alt=""
            className="h-8 w-8 object-contain drop-shadow-[0_0_6px_rgba(236,72,153,0.35)]"
            draggable={false}
          />
          {unread > 0 && !open && (
            <>
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-black text-white shadow-[0_0_10px_rgba(236,72,153,0.7)]">
                {unread > 9 ? "9+" : unread}
              </span>
              <span className="pointer-events-none absolute -right-1 -top-1 h-5 w-5 animate-ping rounded-full bg-neon-pink/60" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="z-[70] w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.14_0.08_305)]/95 p-0 text-white shadow-xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Notificações
            </div>
            <div className="truncate text-sm font-semibold text-white">
              {items.length > 0 ? `${items.length} nova${items.length === 1 ? "" : "s"}` : "Tudo em dia"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                onClick={markAllRead}
                aria-label="Marcar tudo como lido"
                title="Marcar tudo como lido"
                className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-4 h-px bg-white/10" />

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="grid place-items-center py-10 text-white/40 text-xs">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-white/70">Nenhuma nova</div>
              <div className="mt-1 text-[11px] text-white/40">
                Volte mais tarde ou veja o histórico.
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {items.map((item) => {
                const c = item.campaign;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="group relative flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
                  >
                    {c.image ? (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                        <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-white/60 ring-1 ring-white/10">
                        <Bell className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-pink" />
                        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                          {applyNotifTokens(c.title, notifVars)}
                        </div>
                        <div className="shrink-0 text-[10px] text-white/40">
                          {timeAgo(item.latest)}
                        </div>
                      </div>
                      <div className="mt-0.5 line-clamp-2 pl-3.5 text-[11px] text-white/60">{applyNotifTokens(c.body, notifVars)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-4 h-px bg-white/10" />

        {/* Footer */}
        <button
          onClick={() => {
            setOpen(false);
            navigate({ to: "/conta", search: { tab: "notificacoes" } as never });
          }}
          className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-[12px] font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          Ver histórico <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
