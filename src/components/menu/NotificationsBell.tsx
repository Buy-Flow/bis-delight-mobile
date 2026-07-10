import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, ExternalLink, Sparkles, ArrowRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useUnreadNotifications } from "./NotificationsInbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  url: string | null;
  created_at: string;
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

  const loadUnread = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("push_deliveries")
      .select("id, opened_at, created_at, campaign_id, campaign:push_campaigns(id, title, body, image, url, created_at)")
      .is("opened_at", null)
      .order("created_at", { ascending: false })
      .limit(30);

    const rows = (data ?? []) as Delivery[];
    const map = new Map<string, Item>();
    for (const d of rows) {
      const c = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
      if (!c) continue;
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
          <Bell className="h-5 w-5" />
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
        className="z-[70] w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.14_0.08_305)]/95 p-0 text-white shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div
          className="relative px-4 pt-4 pb-3"
          style={{
            background:
              "radial-gradient(120% 100% at 20% 0%, oklch(0.42 0.22 340) 0%, oklch(0.22 0.15 310) 55%, transparent 100%)",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-neon-cyan/25 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink via-neon-pink to-neon-yellow text-white shadow-[0_0_20px_rgba(236,72,153,0.55)]">
              {items.length > 0 ? (
                <BellRing className="h-5 w-5 animate-[wiggle_1.2s_ease-in-out_infinite]" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neon-yellow/90">
                Central de novidades
              </div>
              <div className="truncate font-display text-base font-black leading-tight text-white">
                {items.length > 0 ? `${items.length} nova${items.length === 1 ? "" : "s"}` : "Tudo em dia"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {items.length > 0 && (
            <button
              onClick={markAllRead}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar tudo como lido
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="grid place-items-center py-10 text-white/40 text-xs">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-5 text-center">
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/30 to-neon-cyan/20 text-neon-pink shadow-[0_0_18px_rgba(236,72,153,0.3)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="font-display text-sm font-black text-white">Nenhuma nova</div>
              <div className="mx-auto mt-1 max-w-xs text-[11px] text-white/60">
                Volte mais tarde ou veja o histórico completo.
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {items.map((item) => {
                const c = item.campaign;
                const clickable = !!c.url;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition active:scale-[.99]",
                      "border-neon-pink/40 bg-gradient-to-br from-neon-pink/15 via-purple-900/10 to-neon-cyan/10",
                      clickable && "hover:border-neon-cyan/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-neon-pink to-neon-yellow"
                    />
                    {c.image ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                        <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-pink/25 to-neon-cyan/15 text-neon-pink ring-1 ring-white/10">
                        <Bell className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-pink opacity-70" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-pink shadow-[0_0_8px_theme(colors.pink.400)]" />
                        </span>
                        <div className="min-w-0 flex-1 truncate font-display text-xs font-black text-white">
                          {c.title}
                        </div>
                        <div className="shrink-0 text-[9px] uppercase tracking-widest text-white/40">
                          {timeAgo(item.latest)}
                        </div>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-white/70">{c.body}</div>
                      {clickable && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/30">
                          Abrir <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-white/[0.03] p-2.5">
          <button
            onClick={() => {
              setOpen(false);
              navigate({ to: "/conta", search: { tab: "notificacoes" } as never });
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-yellow px-4 py-2 text-xs font-black uppercase tracking-wider text-[oklch(0.18_0.11_305)] shadow-[0_0_18px_rgba(236,72,153,0.45)] transition active:scale-[.98]"
          >
            Ver histórico completo <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
