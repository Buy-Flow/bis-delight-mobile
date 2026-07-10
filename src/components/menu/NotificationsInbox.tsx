import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
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

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("push_deliveries")
      .select("id, opened_at, created_at, campaign_id, campaign:push_campaigns(id, title, body, image, url, created_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = (data ?? []) as Delivery[];
    // Dedupe by campaign_id — one card per campaign
    const map = new Map<string, Item>();
    for (const d of rows) {
      const c = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
      if (!c) continue;
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

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-neon-pink/20 text-neon-pink">
          <Bell className="h-6 w-6" />
        </div>
        <div className="font-display text-lg font-black text-white">Sem novidades por aqui</div>
        <div className="mt-1 text-xs text-white/60">
          Ative as notificações para receber promoções e novidades em primeira mão.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
          {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] font-semibold text-neon-cyan hover:underline"
          >
            Marcar tudo como lido
          </button>
        )}
      </div>

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
              "group relative flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
              item.anyUnread
                ? "border-neon-pink/40 bg-gradient-to-br from-neon-pink/10 to-purple-800/10"
                : "border-white/10 bg-white/5",
              clickable && "hover:border-neon-cyan/40",
            )}
          >
            {c.image ? (
              <img
                src={c.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-neon-pink/20 text-neon-pink">
                <Bell className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.anyUnread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-neon-pink shadow-[0_0_8px_theme(colors.pink.400)]" />
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
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-neon-cyan">
                  Abrir <ExternalLink className="h-3 w-3" />
                </div>
              )}
            </div>
          </button>
        );
      })}
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
    const { count: c } = await supabase
      .from("push_deliveries")
      .select("id", { count: "exact", head: true })
      .is("opened_at", null);
    setCount(c ?? 0);
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
