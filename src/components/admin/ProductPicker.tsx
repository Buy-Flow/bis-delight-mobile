import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ProductPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (id: string, name?: string) => void;
}) {
  const [items, setItems] = useState<{ id: string; name: string; image_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,image_url")
        .order("name");
      setItems((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => p.name.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.13_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-neon-pink" />
            <span className="font-black">Escolher produto</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/40">Nenhum produto encontrado.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id, p.name)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-black/20 p-2 text-left transition hover:border-neon-pink/40 hover:bg-neon-pink/[0.06]"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/40">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">{p.name}</div>
                      <div className="truncate text-[10px] text-white/40">/produto/{p.id}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
