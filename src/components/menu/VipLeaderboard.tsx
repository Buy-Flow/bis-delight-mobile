import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/cart-context";

type LbRow = {
  rank_pos: number;
  display_name: string;
  ltv: number;
  orders_ct: number;
  is_me: boolean;
};

export function VipLeaderboard() {
  const [rows, setRows] = useState<LbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.rpc("get_vip_leaderboard", { _limit: 20 });
      if (!mounted) return;
      setRows((data as LbRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />;
  }
  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-neon-yellow/30 bg-gradient-to-br from-purple-950/70 via-purple-900/50 to-neon-pink/10 backdrop-blur-md">
      <header className="flex items-center gap-2 border-b border-neon-yellow/20 px-4 py-3">
        <Trophy className="h-5 w-5 text-neon-yellow" />
        <h2
          className="text-lg font-black uppercase tracking-tight text-neon-yellow sm:text-xl"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
        >
          Ranking VIP · Top 20
        </h2>
        <span className="ml-auto rounded-full border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase text-neon-yellow">
          Fãs da casa
        </span>
      </header>

      <ul className="divide-y divide-white/5 px-2 py-2">
        {rows.map((r) => {
          const isTop3 = r.rank_pos <= 3;
          const medal = r.rank_pos === 1 ? "🥇" : r.rank_pos === 2 ? "🥈" : r.rank_pos === 3 ? "🥉" : null;
          return (
            <li
              key={r.rank_pos}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                r.is_me
                  ? "bg-neon-pink/10 ring-1 ring-neon-pink/40"
                  : isTop3
                    ? "bg-neon-yellow/[0.05]"
                    : "hover:bg-white/[0.03]"
              }`}
            >
              <span
                className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  isTop3 ? "bg-neon-yellow/20 text-neon-yellow" : "bg-white/5 text-white/70"
                }`}
              >
                {medal ?? r.rank_pos}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
                  {isTop3 && <Crown className="h-3.5 w-3.5 flex-shrink-0 text-neon-yellow" />}
                  {r.display_name || "Cliente"}
                  {r.is_me && (
                    <span className="ml-1 rounded-full bg-neon-pink/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-neon-pink">
                      Você
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-white/50">{r.orders_ct} pedido(s)</p>
              </div>
              <p
                className={`text-sm font-black ${isTop3 ? "text-neon-yellow" : "text-emerald-300"}`}
              >
                {brl(Number(r.ltv ?? 0))}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-white/5 px-4 py-2 text-center text-[10px] text-white/40">
        Faça pedidos para subir no ranking e desbloquear recompensas.
      </p>
    </section>
  );
}
