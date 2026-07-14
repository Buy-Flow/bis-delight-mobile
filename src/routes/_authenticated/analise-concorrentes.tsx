import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// textarea: use native element (no shadcn textarea in this project)
import { toast } from "sonner";
import {
  Camera, Upload, Sparkles, X, Trash2, Play, TrendingUp, TrendingDown,
  Minus, ScanSearch, Store, Lightbulb, DollarSign, Image as ImgIcon,
  Check, RefreshCw, AlertTriangle, Loader2, Inbox,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

import {
  runCompetitorAnalysis, listCompetitorAnalyses, getCompetitorAnalysis,
  deleteCompetitorAnalysis, applyCompetitorPrice,
  type ExtractedCompetitorItem, type AnalysisSummary,
} from "@/lib/competitor-analysis.functions";

export const Route = createFileRoute("/_authenticated/analise-concorrentes")({
  head: () => ({ meta: [{ title: "Análise de Concorrentes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Tab = "nova" | "historico";

type ListRow = {
  id: string; competitor_name: string; region: string | null;
  status: string; summary: AnalysisSummary | Record<string, never>;
  created_at: string; ai_model: string | null; photo_paths: string[];
};

type FullAnalysis = ListRow & {
  notes: string | null;
  items: ExtractedCompetitorItem[];
  photo_urls: string[];
  summary: AnalysisSummary;
  error_message: string | null;
};

const MODELS = [
  { v: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (mais preciso)" },
  { v: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (rápido)" },
  { v: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { v: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
];

function Page() {
  const [tab, setTab] = useState<Tab>("nova");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [selected, setSelected] = useState<FullAnalysis | null>(null);

  const _list = useServerFn(listCompetitorAnalyses);
  const _get = useServerFn(getCompetitorAnalysis);
  const _del = useServerFn(deleteCompetitorAnalysis);

  const refresh = async () => {
    try { setRows(await _list({}) as ListRow[]); } catch (e) { toast.error((e as Error).message); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const open = async (id: string) => {
    try { const r = await _get({ data: { id } }); setSelected(r as unknown as FullAnalysis); }
    catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (id: string) => {
    if (!(await confirmDialog({ message: "Remover esta análise e todas as fotos?" }))) return;
    try { await _del({ data: { id } }); await refresh(); if (selected?.id === id) setSelected(null); toast.success("Removida."); }
    catch (e) { toast.error((e as Error).message); }
  };

  const kpis = useMemo(() => {
    const done = rows.filter((r) => r.status === "done");
    const totalItems = done.reduce((a, r) => a + ((r.summary as AnalysisSummary).total_items ?? 0), 0);
    const opps = done.reduce((a, r) => a + ((r.summary as AnalysisSummary).opportunities?.length ?? 0), 0);
    const avgGap = (() => {
      const arr = done.map((r) => (r.summary as AnalysisSummary).avg_price_gap_pct).filter((n): n is number => typeof n === "number");
      if (arr.length === 0) return null;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    })();
    return { competitors: done.length, totalItems, opps, avgGap };
  }, [rows]);

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Análise de Concorrentes</h1>
        <p className="text-sm text-slate-500">
          Envie fotos do cardápio da concorrência — a IA extrai os preços, compara com o seu e sugere ajustes.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Kpi label="Concorrentes analisados" value={kpis.competitors} icon={Store} tint="violet" />
        <Kpi label="Itens extraídos" value={kpis.totalItems} icon={ScanSearch} tint="sky" />
        <Kpi label="Oportunidades detectadas" value={kpis.opps} icon={Lightbulb} tint="amber" />
        <Kpi label="Diferença média (nós vs eles)"
          value={kpis.avgGap === null ? "—" : `${kpis.avgGap > 0 ? "+" : ""}${kpis.avgGap.toFixed(1)}%`}
          icon={DollarSign} tint={kpis.avgGap === null ? "slate" : kpis.avgGap > 5 ? "rose" : kpis.avgGap < -5 ? "emerald" : "slate"} />
      </div>

      <div className="mb-4 flex gap-2">
        {(["nova", "historico"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t ? "bg-violet-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}>
            {t === "nova" ? "Nova análise" : `Histórico (${rows.length})`}
          </button>
        ))}
      </div>

      {tab === "nova" && <NewAnalysisForm onDone={async (id) => { await refresh(); await open(id); setTab("historico"); }} />}

      {tab === "historico" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="space-y-2">
            {rows.length === 0 && (
              <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
                Nenhuma análise ainda.
              </div>
            )}
            {rows.map((r) => {
              const s = r.summary as AnalysisSummary;
              const active = selected?.id === r.id;
              return (
                <button key={r.id} onClick={() => open(r.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active ? "bg-violet-50 border-violet-300" : "bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-800 truncate">{r.competitor_name}</div>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {r.region ? r.region + " · " : ""}{new Date(r.created_at).toLocaleString("pt-BR")}
                  </div>
                  {r.status === "done" && (
                    <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-2">
                      <span>📦 {s.total_items ?? 0} itens</span>
                      <span>🎯 {s.matched_items ?? 0} match</span>
                      {typeof s.avg_price_gap_pct === "number" && (
                        <span className={s.avg_price_gap_pct > 5 ? "text-rose-600" : s.avg_price_gap_pct < -5 ? "text-emerald-600" : "text-slate-500"}>
                          Δ {s.avg_price_gap_pct > 0 ? "+" : ""}{s.avg_price_gap_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div>
            {!selected ? (
              <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
                <ScanSearch className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                Selecione uma análise à esquerda.
              </div>
            ) : (
              <AnalysisDetail a={selected} onDelete={() => remove(selected.id)} onRefresh={() => open(selected.id)} />
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/** ==================== New analysis form ==================== */
function NewAnalysisForm({ onDone }: { onDone: (id: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [hint, setHint] = useState("");
  const [model, setModel] = useState(MODELS[0].v);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const _run = useServerFn(runCompetitorAnalysis);

  const compress = (file: File) => new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = url;
  });

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 8 - images.length);
    try {
      const out: string[] = [];
      for (const f of arr) out.push(await compress(f));
      setImages((prev) => [...prev, ...out].slice(0, 8));
    } catch (e) { toast.error((e as Error).message); }
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async () => {
    if (!name.trim()) { toast.error("Informe o nome do concorrente."); return; }
    if (images.length === 0) { toast.error("Adicione pelo menos 1 foto do cardápio."); return; }
    setBusy(true);
    try {
      const res = await _run({ data: {
        competitor_name: name.trim(),
        region: region.trim() || null,
        notes: notes.trim() || null,
        images, hint: hint.trim() || null, model,
      } });
      toast.success(`Análise concluída: ${res.items.length} itens extraídos.`);
      setName(""); setRegion(""); setNotes(""); setHint(""); setImages([]);
      await onDone(res.id);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Store className="h-4 w-4" /> Concorrente</h3>
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Açaí do Rico" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Região / bairro</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ex: Centro" />
          </div>
          <div>
            <Label>Modelo IA</Label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              {MODELS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Dica de contexto (opcional)</Label>
          <Input value={hint} onChange={(e) => setHint(e.target.value)}
            placeholder="Ex: cardápio de açaí, foco no tamanho 500ml" />
        </div>
        <div>
          <Label>Anotações internas</Label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Impressões, promoções em andamento, etc."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />

        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Camera className="h-4 w-4" /> Fotos do cardápio</h3>
        <p className="text-xs text-slate-500">Até 8 fotos. Prefira imagens nítidas e bem iluminadas. Aceita fotos de placa, panfleto, foto do celular ou print do Instagram/iFood.</p>

        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-50">
              <img src={src} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => setImages(images.filter((_, x) => x !== i))}
                className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:border-violet-400 hover:text-violet-600 text-xs">
              <Upload className="h-6 w-6 mb-1" />
              Adicionar
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />

        <Button onClick={run} disabled={busy || images.length === 0 || !name.trim()}
          className="w-full bg-violet-600 hover:bg-violet-700">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando…</> : <><Sparkles className="mr-2 h-4 w-4" /> Analisar cardápio</>}
        </Button>

        <p className="text-[11px] text-slate-400">
          A IA compara os itens extraídos com o seu catálogo pelo nome e sugere ajustes de preço.
          As fotos ficam privadas — só admins podem ver.
        </p>
      </section>
    </div>
  );
}

/** ==================== Analysis detail ==================== */
function AnalysisDetail({ a, onDelete, onRefresh }: { a: FullAnalysis; onDelete: () => void; onRefresh: () => void }) {
  const _apply = useServerFn(applyCompetitorPrice);
  const [filter, setFilter] = useState<"all" | "cheaper" | "similar" | "expensive" | "no-match">("all");
  const [q, setQ] = useState("");

  const items = a.items ?? [];
  const filtered = items.filter((it) => {
    if (filter !== "all" && it.positioning !== filter) return false;
    if (q && !`${it.name} ${it.match_product_name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const apply = async (pid: string, price: number) => {
    if (!(await confirmDialog({ message: `Aplicar novo preço de R$ ${price.toFixed(2)}?` }))) return;
    try { await _apply({ data: { product_id: pid, new_price: price } }); toast.success("Preço atualizado."); onRefresh(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{a.competitor_name}</h2>
            <div className="text-xs text-slate-500">
              {a.region ? a.region + " · " : ""}
              {new Date(a.created_at).toLocaleString("pt-BR")} · {a.ai_model}
            </div>
          </div>
          <div className="flex gap-2">
            <StatusPill status={a.status} />
            <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" className="text-rose-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {a.status === "error" && (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" /> {a.error_message ?? "Falha na análise."}
          </div>
        )}

        {a.status === "done" && (
          <>
            <p className="mt-3 text-sm text-slate-700"><b>💡 </b>{a.summary.headline}</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <MiniStat label="Total" value={a.summary.total_items} tint="slate" />
              <MiniStat label="Mais barato que nós" value={a.summary.we_expensive_count} tint="rose" hint="Ele" />
              <MiniStat label="Similar" value={a.summary.we_similar_count} tint="slate" />
              <MiniStat label="Mais caro que nós" value={a.summary.we_cheaper_count} tint="emerald" hint="Ele" />
            </div>
          </>
        )}
      </div>

      {a.photo_urls?.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><ImgIcon className="h-4 w-4" /> Fotos analisadas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {a.photo_urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border">
                <img src={u} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {a.summary.opportunities?.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Oportunidades detectadas</h3>
          <div className="space-y-2">
            {a.summary.opportunities.map((o, i) => (
              <div key={i} className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex items-start gap-2">
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase">{o.kind}</span>
                <span className="flex-1">{o.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-800">Itens extraídos ({items.length})</h3>
          <div className="ml-auto flex flex-wrap gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-8 w-40 text-sm" />
            {(["all", "expensive", "similar", "cheaper", "no-match"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
                {f === "all" ? "Todos" : f === "expensive" ? "Ele mais barato" : f === "cheaper" ? "Ele mais caro" : f === "similar" ? "Similar" : "Sem match"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b">
              <tr>
                <th className="text-left py-2 pr-2">Item deles</th>
                <th className="text-right px-2">Preço deles</th>
                <th className="text-left px-2">Nosso item</th>
                <th className="text-right px-2">Nosso preço</th>
                <th className="text-right px-2">Δ</th>
                <th className="text-left px-2">Sugestão IA</th>
                <th className="text-right pl-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Nenhum item.</td></tr>
              )}
              {filtered.map((it, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  <td className="py-2 pr-2 align-top">
                    <div className="font-medium text-slate-800">{it.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {it.category}{it.size ? ` · ${it.size}` : ""}{it.badge ? ` · ${it.badge}` : ""}
                    </div>
                  </td>
                  <td className="text-right px-2 align-top tabular-nums">
                    {it.price > 0 ? `R$ ${it.price.toFixed(2)}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 align-top text-slate-700">
                    {it.match_product_name ?? <span className="text-slate-400 italic">sem match</span>}
                  </td>
                  <td className="text-right px-2 align-top tabular-nums">
                    {typeof it.match_our_price === "number" ? `R$ ${it.match_our_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="text-right px-2 align-top tabular-nums">
                    <GapBadge pct={it.price_gap_pct} positioning={it.positioning} />
                  </td>
                  <td className="px-2 align-top text-xs text-slate-600 max-w-[240px]">
                    {it.ai_suggestion ?? "—"}
                  </td>
                  <td className="text-right pl-2 align-top">
                    {it.match_product_id && it.price > 0 && (
                      <Button size="sm" variant="outline" onClick={() => apply(it.match_product_id!, it.price)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Igualar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {a.notes && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Anotações</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.notes}</p>
        </div>
      )}
    </div>
  );
}

/** ==================== Small components ==================== */
function Kpi({ label, value, icon: Icon, tint }: { label: string; value: number | string; icon: typeof Store; tint: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide">
        <Icon className={`h-4 w-4 text-${tint}-600`} /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    done: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Concluído" },
    processing: { bg: "bg-sky-100", text: "text-sky-700", label: "Processando" },
    pending: { bg: "bg-slate-100", text: "text-slate-600", label: "Aguardando" },
    error: { bg: "bg-rose-100", text: "text-rose-700", label: "Erro" },
  };
  const s = map[status] ?? map.pending;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
}

function MiniStat({ label, value, tint, hint }: { label: string; value: number; tint: string; hint?: string }) {
  return (
    <div className={`rounded-lg border p-2 bg-${tint}-50 border-${tint}-200`}>
      <div className="text-[10px] uppercase text-slate-500">{hint ? `${hint} ` : ""}{label}</div>
      <div className={`text-lg font-bold text-${tint}-800`}>{value}</div>
    </div>
  );
}

function GapBadge({ pct, positioning }: { pct?: number | null; positioning?: string | null }) {
  if (typeof pct !== "number") return <span className="text-slate-400">—</span>;
  const Icon = positioning === "cheaper" ? TrendingUp : positioning === "expensive" ? TrendingDown : Minus;
  const cls = positioning === "cheaper" ? "text-emerald-600" : positioning === "expensive" ? "text-rose-600" : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}
