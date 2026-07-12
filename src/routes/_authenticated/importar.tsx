import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  FileDown,
  UploadCloud,
  FileSpreadsheet,
  ClipboardPaste,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Plus,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Download,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { extractMenuFromMedia } from "@/lib/menu-import.functions";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar cardápio — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportarPage,
});

type FieldKey = "name" | "description" | "category" | "price" | "image_url" | "badge";
type Draft = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  badge: string;
  _errors: string[];
  _include: boolean;
};

const FIELDS: { key: FieldKey; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "name",        label: "Nome",        required: true, aliases: ["name","nome","produto","item","título","titulo"] },
  { key: "category",    label: "Categoria",   required: true, aliases: ["category","categoria","grupo","tipo","secao","seção"] },
  { key: "description", label: "Descrição",   aliases: ["description","descricao","descrição","detalhes","obs"] },
  { key: "price",       label: "Preço",       required: true, aliases: ["price","preco","preço","valor","r$","rs"] },
  { key: "image_url",   label: "Imagem URL",  aliases: ["image","imagem","foto","url","picture","photo"] },
  { key: "badge",       label: "Selo",        aliases: ["badge","selo","tag","destaque"] },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `p-${Date.now()}`;

const parsePrice = (v: any): number => {
  if (typeof v === "number") return Math.max(0, v);
  if (v == null) return 0;
  const s = String(v).replace(/r\$|\s/gi, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
};

function ImportarPage() {
  const [tab, setTab] = useState<"upload" | "text" | "ai">("upload");
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | "">>({
    name: "", description: "", category: "", price: "", image_url: "", badge: "",
  });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const [aiPreviews, setAiPreviews] = useState<string[]>([]);
  const [aiHint, setAiHint] = useState("");
  const [textInput, setTextInput] = useState("");
  const [aiText, setAiText] = useState("");

  const extractFn = useServerFn(extractMenuFromMedia);

  /* ---------- Parsing helpers ---------- */

  const autoMap = (hdrs: string[]) => {
    const norm = hdrs.map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const m: Record<FieldKey, string> = { name: "", description: "", category: "", price: "", image_url: "", badge: "" };
    for (const f of FIELDS) {
      for (let i = 0; i < norm.length; i++) {
        if (f.aliases.some((a) => norm[i].includes(a))) { m[f.key] = hdrs[i]; break; }
      }
    }
    setMapping(m);
  };

  const parseCsvText = (text: string) => {
    // Simple CSV/TSV parser respecting quotes
    const delim = (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ";" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return { headers: [], rows: [] };
    const split = (line: string) => {
      const out: string[] = []; let cur = ""; let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === delim && !q) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const hdrs = split(lines[0]);
    const rows = lines.slice(1).map((l) => {
      const parts = split(l);
      const obj: Record<string, any> = {};
      hdrs.forEach((h, i) => (obj[h] = parts[i] ?? ""));
      return obj;
    });
    return { headers: hdrs, rows };
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      const hdrs = rows.length ? Object.keys(rows[0]) : [];
      setRawRows(rows); setHeaders(hdrs); autoMap(hdrs); setStep(2);
      toast.success(`${rows.length} linhas lidas`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao ler arquivo");
    } finally { setBusy(false); }
  };

  const onTextParse = () => {
    if (!textInput.trim()) { toast.error("Cole o conteúdo primeiro"); return; }
    try {
      const trimmed = textInput.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const j = JSON.parse(trimmed);
        const arr: Record<string, any>[] = Array.isArray(j) ? j : (j.items ?? j.products ?? []);
        const hdrs = arr.length ? Array.from(new Set(arr.flatMap((r) => Object.keys(r)))) : [];
        setRawRows(arr); setHeaders(hdrs); autoMap(hdrs); setStep(2);
        toast.success(`${arr.length} itens lidos do JSON`);
        return;
      }
      const { headers: hdrs, rows } = parseCsvText(textInput);
      setRawRows(rows); setHeaders(hdrs); autoMap(hdrs); setStep(2);
      toast.success(`${rows.length} linhas lidas`);
    } catch (e: any) {
      toast.error(e.message || "Não consegui interpretar o texto");
    }
  };

  const onAiFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files).slice(0, 6);
    const previews = await Promise.all(arr.map((f) => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    })));
    setAiPreviews(previews);
  };

  const runAiExtract = async () => {
    if (!aiPreviews.length && !aiText.trim()) { toast.error("Envie imagens ou cole texto"); return; }
    setBusy(true);
    try {
      const { items } = await extractFn({
        data: {
          images: aiPreviews.length ? aiPreviews : undefined,
          text: aiText.trim() || undefined,
          hint: aiHint || undefined,
        },
      });
      if (!items.length) { toast.error("Nada foi extraído — verifique a imagem"); return; }
      // Feed as if it was parsed rows with fixed mapping
      const rows = items.map((i) => ({
        name: i.name, description: i.description, category: i.category,
        price: i.price, image_url: "", badge: i.badge ?? "",
      }));
      setRawRows(rows);
      setHeaders(["name","description","category","price","image_url","badge"]);
      setMapping({ name: "name", description: "description", category: "category",
        price: "price", image_url: "image_url", badge: "badge" });
      toast.success(`${items.length} itens extraídos pela IA`);
      // Auto-build drafts and jump
      buildDrafts(rows, {
        name: "name", description: "description", category: "category",
        price: "price", image_url: "image_url", badge: "badge",
      });
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Falha na IA");
    } finally { setBusy(false); }
  };

  /* ---------- Draft build & validation ---------- */

  const buildDrafts = (rows: Record<string, any>[], m: Record<FieldKey, string>) => {
    const list: Draft[] = rows.map((r, idx) => {
      const name = String(r[m.name] ?? "").trim();
      const description = String(r[m.description] ?? "").trim();
      const category = String(r[m.category] ?? "").trim();
      const price = parsePrice(r[m.price]);
      const image_url = String(r[m.image_url] ?? "").trim();
      const badge = String(r[m.badge] ?? "").trim();
      const errs: string[] = [];
      if (!name) errs.push("Nome vazio");
      if (!category) errs.push("Categoria vazia");
      if (price <= 0) errs.push("Preço inválido");
      return {
        id: `d${idx}-${Math.random().toString(36).slice(2, 7)}`,
        name, description: description || name, category, price, image_url, badge,
        _errors: errs, _include: errs.length === 0,
      };
    });
    setDrafts(list);
  };

  const confirmMapping = () => {
    if (!mapping.name || !mapping.category || !mapping.price) {
      toast.error("Mapeie nome, categoria e preço");
      return;
    }
    buildDrafts(rawRows, mapping as Record<FieldKey, string>);
    setStep(3);
  };

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, ...patch };
      const errs: string[] = [];
      if (!next.name) errs.push("Nome vazio");
      if (!next.category) errs.push("Categoria vazia");
      if (!next.price || next.price <= 0) errs.push("Preço inválido");
      next._errors = errs;
      if (patch._include === undefined && errs.length) next._include = false;
      return next;
    }));
  };

  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));
  const addBlank = () => setDrafts((p) => [...p, {
    id: `d${p.length}-${Math.random().toString(36).slice(2, 7)}`,
    name: "", description: "", category: "", price: 0, image_url: "", badge: "",
    _errors: ["Nome vazio","Categoria vazia","Preço inválido"], _include: false,
  }]);

  const stats = useMemo(() => {
    const total = drafts.length;
    const ok = drafts.filter((d) => d._errors.length === 0).length;
    const errs = total - ok;
    const included = drafts.filter((d) => d._include).length;
    const cats = new Set(drafts.filter((d) => d._include && d.category).map((d) => d.category));
    return { total, ok, errs, included, cats: cats.size };
  }, [drafts]);

  const bulkToggle = (mode: "all" | "none" | "valid") => {
    setDrafts((p) => p.map((d) => ({
      ...d,
      _include: mode === "all" ? true : mode === "none" ? false : d._errors.length === 0,
    })));
  };

  /* ---------- Import ---------- */

  const doImport = async () => {
    const list = drafts.filter((d) => d._include && d._errors.length === 0);
    if (!list.length) { toast.error("Nenhum item válido selecionado"); return; }
    setBusy(true);
    setProgress({ done: 0, total: list.length });

    // 1. Ensure categories
    const uniqCats = Array.from(new Set(list.map((d) => d.category)));
    const { data: existingCats } = await supabase.from("categories").select("id, name");
    const existingByName = new Map<string, string>((existingCats ?? []).map((c: any) =>
      [String(c.name).toLowerCase(), c.id]));
    const catInserts: any[] = [];
    const catIdByName = new Map<string, string>();
    let sortBase = (existingCats?.length ?? 0);
    for (const c of uniqCats) {
      const key = c.toLowerCase();
      if (existingByName.has(key)) { catIdByName.set(c, existingByName.get(key)!); continue; }
      const id = slugify(c);
      catInserts.push({ id, name: c, emoji: "🍽️", sort_order: sortBase++, active: true });
      catIdByName.set(c, id);
    }
    if (catInserts.length) {
      const { error } = await supabase.from("categories").insert(catInserts);
      if (error) { toast.error(`Categorias: ${error.message}`); setBusy(false); setProgress(null); return; }
    }

    // 2. Insert products in batches
    const now = Date.now();
    const products = list.map((d, i) => ({
      id: `${slugify(d.name)}-${now}-${i}`,
      name: d.name,
      category: catIdByName.get(d.category) || slugify(d.category),
      description: d.description || d.name,
      base_price: d.price,
      image_url: d.image_url || null,
      badge: d.badge || null,
      ingredients: [],
      sizes: [],
      flavors: [],
      extras: [],
      removable: [],
      hero: false,
      active: true,
      is_custom: false,
      is_upsell: false,
      sort_order: i,
    }));

    let done = 0;
    const batchSize = 50;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const { error } = await supabase.from("products").insert(batch);
      if (error) {
        toast.error(`Erro no lote ${i + 1}: ${error.message}`);
        setBusy(false); setProgress(null);
        return;
      }
      done += batch.length;
      setProgress({ done, total: products.length });
    }

    setBusy(false); setProgress(null);
    toast.success(`${products.length} produtos importados! ${catInserts.length ? `${catInserts.length} categorias criadas.` : ""}`);
    // Reset
    setDrafts([]); setRawRows([]); setHeaders([]); setStep(1);
    setAiPreviews([]); setAiText(""); setTextInput(""); setAiHint("");
  };

  const downloadTemplate = () => {
    const csv = "name,category,description,price,image_url,badge\n" +
      "Açaí 500ml,Açaí,Açaí cremoso com granola,22.90,,Popular\n" +
      "Milk Shake Ninho,Shakes,Milk shake de leite ninho,18.00,,\n";
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-cardapio.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white pb-24">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 grid place-items-center text-white">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Importar cardápio</h1>
              <p className="text-xs md:text-sm text-slate-500">Planilha, texto ou uma foto do cardápio — a IA extrai tudo pra você.</p>
            </div>
          </div>
          <button onClick={downloadTemplate}
            className="h-10 px-4 rounded-lg border bg-white hover:bg-slate-50 text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Baixar modelo CSV
          </button>
        </div>

        {/* Stepper */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-3 flex items-center gap-2 text-xs text-slate-600 overflow-x-auto">
          {[
            { n: 1, label: "Fonte" },
            { n: 2, label: "Mapear colunas" },
            { n: 3, label: "Revisar e importar" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={cn("h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold",
                step === s.n ? "bg-slate-900 text-white"
                  : step > s.n ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500")}>
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={cn(step === s.n ? "font-semibold text-slate-900" : "")}>{s.label}</span>
              {i < 2 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {step === 1 && (
          <>
            {/* Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: "upload", label: "Planilha", desc: "CSV, XLSX, XLS", icon: FileSpreadsheet, color: "from-emerald-500 to-emerald-600" },
                { id: "text", label: "Colar texto", desc: "CSV ou JSON", icon: ClipboardPaste, color: "from-sky-500 to-sky-600" },
                { id: "ai", label: "IA (foto/PDF)", desc: "Gemini vision", icon: Sparkles, color: "from-fuchsia-500 to-violet-600" },
              ].map((t) => {
                const Icon = t.icon; const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id as any)}
                    className={cn("p-5 rounded-2xl border text-left transition group",
                      active ? "border-slate-900 bg-white shadow-md" : "border-slate-200 bg-white hover:border-slate-400")}>
                    <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white grid place-items-center mb-3", t.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="font-semibold text-slate-900">{t.label}</div>
                    <div className="text-xs text-slate-500">{t.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Panels */}
            {tab === "upload" && (
              <div className="rounded-2xl border-2 border-dashed bg-white p-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <div className="h-14 w-14 rounded-full bg-emerald-50 grid place-items-center mx-auto mb-3">
                  <UploadCloud className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="font-semibold text-slate-900">Arraste o arquivo aqui</div>
                <div className="text-sm text-slate-500 mb-4">ou</div>
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  className="h-11 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">
                  {busy ? "Lendo…" : "Escolher arquivo"}
                </button>
                <div className="text-xs text-slate-400 mt-4">CSV, XLSX, XLS ou TSV — até 20MB</div>
              </div>
            )}

            {tab === "text" && (
              <div className="rounded-2xl border bg-white p-5 space-y-3">
                <label className="text-sm font-medium text-slate-700">Cole CSV ou JSON</label>
                <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={12}
                  placeholder={`name,category,description,price\nAçaí 500ml,Açaí,Cremoso,22.90\n\n— ou JSON —\n[{"name":"Açaí","category":"Açaí","price":22.9}]`}
                  className="w-full rounded-lg border p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900" />
                <div className="flex justify-end">
                  <button onClick={onTextParse}
                    className="h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center gap-2">
                    Analisar <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div className="rounded-2xl border bg-white p-5 space-y-4">
                <div className="rounded-lg bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-fuchsia-100 p-3 text-sm text-slate-700 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-fuchsia-600 mt-0.5" />
                  <div>
                    Envie fotos do cardápio (até 6) ou um PDF exportado como imagem. A IA identifica produtos, preços e categorias.
                    Ideal pra migrar cardápios impressos ou de concorrentes.
                  </div>
                </div>

                <input ref={aiFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => onAiFiles(e.target.files)} />
                {aiPreviews.length === 0 ? (
                  <button onClick={() => aiFileRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-xl p-10 text-center hover:bg-slate-50">
                    <ImageIcon className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                    <div className="font-semibold text-slate-900">Escolher fotos do cardápio</div>
                    <div className="text-xs text-slate-500">JPG, PNG — até 6 imagens</div>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {aiPreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setAiPreviews((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => aiFileRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed grid place-items-center text-slate-400 hover:bg-slate-50">
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-700">Ou cole o texto do cardápio (opcional)</label>
                  <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={4}
                    placeholder="Ex: Açaí 500ml - R$ 22,90; Milk Shake Ninho - R$ 18,00…"
                    className="mt-1 w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Dica pra IA (opcional)</label>
                  <input value={aiHint} onChange={(e) => setAiHint(e.target.value)}
                    placeholder="Ex: só considere lanches, ignore bebidas."
                    className="mt-1 w-full h-10 rounded-lg border px-3 text-sm" />
                </div>

                <div className="flex justify-end">
                  <button onClick={runAiExtract} disabled={busy || (!aiPreviews.length && !aiText.trim())}
                    className="h-11 px-5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo…</> : <><Sparkles className="h-4 w-4" /> Extrair com IA</>}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <div className="rounded-2xl border bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Mapear colunas</h2>
                <p className="text-xs text-slate-500">{rawRows.length} linhas · associe cada campo à coluna correta.</p>
              </div>
              <button onClick={() => { setStep(1); setRawRows([]); setHeaders([]); }}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
                <RefreshCcw className="h-3.5 w-3.5" /> Trocar arquivo
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <div className="text-sm font-medium text-slate-800">
                      {f.label}{f.required && <span className="text-rose-500"> *</span>}
                    </div>
                  </div>
                  <select value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    className="flex-1 h-10 rounded-lg border bg-white px-3 text-sm">
                    <option value="">— não mapear —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-slate-50 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>{headers.map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-t">
                      {headers.map((h) => <td key={h} className="p-2 text-slate-700 truncate max-w-[200px]">{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-400 p-2">Prévia das 3 primeiras linhas</div>
            </div>

            <div className="flex justify-end">
              <button onClick={confirmMapping}
                className="h-11 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center gap-2">
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Total" value={stats.total} />
              <Stat label="Válidos" value={stats.ok} tone="emerald" />
              <Stat label="Com erros" value={stats.errs} tone="rose" />
              <Stat label="Selecionados" value={stats.included} tone="indigo" />
              <Stat label="Categorias" value={stats.cats} tone="slate" />
            </div>

            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <button onClick={() => bulkToggle("all")} className="text-xs px-2 py-1 rounded border hover:bg-slate-50">Selecionar todos</button>
                  <button onClick={() => bulkToggle("valid")} className="text-xs px-2 py-1 rounded border hover:bg-slate-50">Só válidos</button>
                  <button onClick={() => bulkToggle("none")} className="text-xs px-2 py-1 rounded border hover:bg-slate-50">Nenhum</button>
                  <button onClick={addBlank} className="text-xs px-2 py-1 rounded border hover:bg-slate-50 flex items-center gap-1"><Plus className="h-3 w-3" />Adicionar linha</button>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
                  <RefreshCcw className="h-3.5 w-3.5" /> Recomeçar
                </button>
              </div>
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs sticky top-0">
                    <tr>
                      <th className="p-2 w-10"></th>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Categoria</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-right">Preço</th>
                      <th className="p-2 text-left">Imagem</th>
                      <th className="p-2 text-left">Selo</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d) => (
                      <tr key={d.id} className={cn("border-t hover:bg-slate-50", d._errors.length && "bg-rose-50/40")}>
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={d._include} disabled={d._errors.length > 0}
                            onChange={(e) => updateDraft(d.id, { _include: e.target.checked })} />
                        </td>
                        <td className="p-1"><Cell val={d.name} onChange={(v) => updateDraft(d.id, { name: v })} /></td>
                        <td className="p-1"><Cell val={d.category} onChange={(v) => updateDraft(d.id, { category: v })} /></td>
                        <td className="p-1"><Cell val={d.description} onChange={(v) => updateDraft(d.id, { description: v })} /></td>
                        <td className="p-1">
                          <input type="number" step="0.01" value={d.price}
                            onChange={(e) => updateDraft(d.id, { price: parseFloat(e.target.value) || 0 })}
                            className="w-20 h-8 rounded border px-2 text-right tabular-nums text-xs" />
                        </td>
                        <td className="p-1"><Cell val={d.image_url} onChange={(v) => updateDraft(d.id, { image_url: v })} placeholder="URL" /></td>
                        <td className="p-1"><Cell val={d.badge} onChange={(v) => updateDraft(d.id, { badge: v })} placeholder="—" /></td>
                        <td className="p-2 text-center">
                          {d._errors.length > 0 && (
                            <span title={d._errors.join(", ")} className="inline-flex text-amber-500"><AlertTriangle className="h-4 w-4" /></span>
                          )}
                          <button onClick={() => removeDraft(d.id)} className="ml-1 text-slate-400 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!drafts.length && (
                      <tr><td colSpan={8} className="p-10 text-center text-sm text-slate-400">Nada para revisar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sticky bottom-4">
              <div className="rounded-2xl border bg-white shadow-lg p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm text-slate-600">
                  {progress ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />
                      Importando {progress.done}/{progress.total}…</span>
                  ) : (
                    <>Vamos importar <b>{stats.included}</b> produtos
                    {stats.cats > 0 && <> em <b>{stats.cats}</b> categoria{stats.cats > 1 ? "s" : ""}</>}.</>
                  )}
                </div>
                <button onClick={doImport} disabled={busy || stats.included === 0}
                  className="h-11 px-6 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Confirmar importação
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900", emerald: "text-emerald-700",
    rose: "text-rose-700", indigo: "text-indigo-700",
  };
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", tones[tone])}>{value}</div>
    </div>
  );
}

function Cell({ val, onChange, placeholder }: { val: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={val} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-8 rounded border px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900" />
  );
}
