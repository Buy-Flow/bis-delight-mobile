import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
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
  anyUnread: boolean;
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

export function NotificationsInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const notifVars = useNotifVars();

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("push_deliveries")
      .select("id, opened_at, created_at, campaign_id, campaign:push_campaigns(id, title, body, image, url, created_at, expires_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = (data ?? []) as Delivery[];
    const now = Date.now();
    // Dedupe by campaign_id — one card per campaign
    const map = new Map<string, Item>();
    for (const d of rows) {
      const c = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
      if (!c) continue;
      if (c.expires_at && new Date(c.expires_at).getTime() <= now) continue;
      const prev = map.get(d.campaign_id);
      if (prev) {
        prev.deliveryIds.push(d.id);
        prev.anyUnread = prev.anyUnread || !d.opened_at;
        if (d.created_at > prev.latest) prev.latest = d.created_at;
      } else {
        map.set(d.campaign_id, {
          deliveryIds: [d.id],
          anyUnread: !d.opened_at,
          latest: d.created_at,
          campaign: c,
        });
      }
    }
    const list = Array.from(map.values()).sort((a, b) => (a.latest < b.latest ? 1 : -1));
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("inbox-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "push_deliveries" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = async (item: Item) => {
    if (!item.anyUnread) return;
    await supabase
      .from("push_deliveries")
      .update({ opened_at: new Date().toISOString() })
      .in("id", item.deliveryIds)
      .is("opened_at", null);
    setItems((prev) =>
      prev.map((it) => (it.campaign.id === item.campaign.id ? { ...it, anyUnread: false } : it)),
    );
  };

  const markAllRead = async () => {
    const ids = items.filter((i) => i.anyUnread).flatMap((i) => i.deliveryIds);
    if (!ids.length) return;
    await supabase
      .from("push_deliveries")
      .update({ opened_at: new Date().toISOString() })
      .in("id", ids)
      .is("opened_at", null);
    setItems((prev) => prev.map((i) => ({ ...i, anyUnread: false })));
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const unreadCount = items.filter((i) => i.anyUnread).length;


  const Hero = () => (
    <div
      className="relative mb-5 overflow-hidden rounded-3xl border border-white/10 p-6"
      style={{
        background:
          "radial-gradient(120% 100% at 20% 0%, oklch(0.42 0.22 340) 0%, oklch(0.22 0.15 310) 55%, oklch(0.12 0.08 300) 100%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-cyan/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-10 -bottom-16 h-48 w-48 rounded-full bg-neon-pink/30 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background:
            "radial-gradient(60% 40% at 80% 90%, oklch(0.85 0.20 100 / 0.25), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink via-neon-pink to-neon-yellow text-white shadow-[0_0_32px_rgba(236,72,153,0.65)]">
          {unreadCount > 0 ? (
            <BellRing className="h-8 w-8 animate-[wiggle_1.2s_ease-in-out_infinite]" />
          ) : (
            <Bell className="h-8 w-8" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-neon-yellow px-1.5 text-[11px] font-black text-[oklch(0.18_0.11_305)] shadow-[0_0_12px_rgba(255,215,60,0.6)]">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neon-yellow/90">
            Central de novidades
          </div>
          <div className="mt-0.5 font-display text-2xl font-black leading-tight text-white">
            {unreadCount > 0
              ? `${unreadCount} nova${unreadCount === 1 ? "" : "s"} pra você`
              : "Tudo em dia por aqui"}
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Promoções, recompensas e recadinhos da Quero Bis.
          </div>
        </div>
      </div>
      {unreadCount > 0 && (
        <button
          onClick={markAllRead}
          className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Marcar tudo como lido
        </button>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="relative">
        <Hero />
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-neon-pink/20 blur-3xl" />
          <div className="relative mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/30 to-neon-cyan/20 text-neon-pink shadow-[0_0_24px_rgba(236,72,153,0.35)]">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="font-display text-lg font-black text-white">Sem novidades por aqui</div>
          <div className="mx-auto mt-1 max-w-xs text-xs text-white/60">
            Ative as notificações para receber promoções e novidades em primeira mão.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Hero />
      <div className="space-y-2.5">
        {items.map((item) => {
          const c = item.campaign;
          const clickable = !!c.url;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                markRead(item);
                if (c.url) {
                  if (c.url.startsWith("http")) window.open(c.url, "_blank");
                  else window.location.href = c.url;
                }
              }}
              className={cn(
                "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[.99]",
                item.anyUnread
                  ? "border-neon-pink/40 bg-gradient-to-br from-neon-pink/15 via-purple-900/10 to-neon-cyan/10 shadow-[0_0_0_1px_rgba(236,72,153,0.15),0_8px_24px_-12px_rgba(236,72,153,0.5)]"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]",
                clickable && "hover:border-neon-cyan/40",
              )}
            >
              {item.anyUnread && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-neon-pink to-neon-yellow"
                />
              )}
              {c.image ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <img
                    src={c.image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-pink/25 to-neon-cyan/15 text-neon-pink ring-1 ring-white/10">
                  <Bell className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.anyUnread && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-pink opacity-70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-pink shadow-[0_0_8px_theme(colors.pink.400)]" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 truncate font-display text-sm font-black text-white">
                    {c.title}
                  </div>
                  <div className="shrink-0 text-[10px] uppercase tracking-widest text-white/40">
                    {timeAgo(item.latest)}
                  </div>
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-white/70">{c.body}</div>
                {clickable && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/30">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

}

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const { data } = await supabase
      .from("push_deliveries")
      .select("id, campaign_id, campaign:push_campaigns(expires_at)")
      .is("opened_at", null)
      .limit(200);
    const now = Date.now();
    const rows = (data ?? []) as Array<{ id: string; campaign_id: string; campaign: { expires_at: string | null } | { expires_at: string | null }[] | null }>;
    const uniqueCampaigns = new Set<string>();
    for (const r of rows) {
      const c = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
      if (c?.expires_at && new Date(c.expires_at).getTime() <= now) continue;
      uniqueCampaigns.add(r.campaign_id);
    }
    setCount(uniqueCampaigns.size);
  };


  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("inbox-count-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "push_deliveries" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return count;
}
