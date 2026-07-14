import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera, RefreshCcw, Check, X, Loader2, MapPin, AlertTriangle,
  Hand, Home, Users, DoorClosed, PackageX, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Settings = {
  enabled: boolean;
  require_photo: boolean;
  require_gps: boolean;
  require_notes: boolean;
  allow_skip: boolean;
  require_skip_reason: boolean;
  allowed_skip_reasons: string[];
  contact_types: string[];
  photo_quality: number;
  max_photo_kb: number;
  watermark: boolean;
  watermark_show_time: boolean;
  watermark_show_order: boolean;
  watermark_show_courier: boolean;
  block_completion_without_proof: boolean;
};

const CONTACT_LABELS: Record<string, { label: string; icon: any }> = {
  entregue_mao: { label: "Em mãos", icon: Hand },
  portaria: { label: "Portaria", icon: Home },
  vizinho: { label: "Vizinho", icon: Users },
  porta: { label: "Na porta", icon: DoorClosed },
  sem_contato: { label: "Sem contato", icon: PackageX },
};

export function DeliveryProofDialog({
  open,
  onClose,
  onConfirm,
  orderId,
  orderNumber,
  courierName,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    photo_url: string | null;
    lat: number | null;
    lng: number | null;
    notes: string | null;
    skipped_reason: string | null;
    contact_type: string | null;
  }) => Promise<void>;
  orderId: string;
  orderNumber: string | number;
  courierName: string;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [step, setStep] = useState<"capture" | "review" | "skip">("capture");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [contactType, setContactType] = useState<string>("entregue_mao");
  const [notes, setNotes] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [customSkip, setCustomSkip] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("capture");
    setPhotoBlob(null); setPhotoPreview(null);
    setNotes(""); setSkipReason(""); setCustomSkip("");
    setContactType("entregue_mao");

    (async () => {
      const { data } = await supabase
        .from("proof_of_delivery_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (data) setSettings(data as any);
    })();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoord({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    }
  }, [open]);

  const handleFile = async (file: File) => {
    const q = settings?.photo_quality ?? 0.75;
    const maxKb = settings?.max_photo_kb ?? 800;
    const blob = await compressWithWatermark(file, {
      quality: q,
      maxKb,
      watermark: settings?.watermark ?? true,
      lines: [
        settings?.watermark_show_order !== false ? `Pedido #${orderNumber}` : "",
        settings?.watermark_show_courier !== false ? courierName : "",
        settings?.watermark_show_time !== false ? new Date().toLocaleString("pt-BR") : "",
      ].filter(Boolean) as string[],
    });
    setPhotoBlob(blob);
    setPhotoPreview(URL.createObjectURL(blob));
    setStep("review");
  };

  const submit = async () => {
    setUploading(true);
    try {
      let photoUrl: string | null = null;

      if (photoBlob) {
        const path = `${orderId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("delivery-proofs")
          .upload(path, photoBlob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        photoUrl = path;
      }

      if (settings?.require_gps && !coord && photoUrl) {
        toast.warning("Sem GPS — a foto foi enviada mesmo assim.");
      }

      const finalReason =
        step === "skip"
          ? (skipReason === "__other__" ? customSkip.trim() : skipReason).trim() || null
          : null;

      await onConfirm({
        photo_url: photoUrl,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        notes: notes.trim() || null,
        skipped_reason: finalReason,
        contact_type: contactType,
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar prova");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const canSkip = settings?.allow_skip ?? true;
  const needsReason = settings?.require_skip_reason ?? true;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#08040f]">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
          <X className="h-5 w-5 text-white" />
        </button>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">
            Prova de entrega
          </div>
          <div className="text-sm font-black text-white truncate">
            Pedido #{String(orderNumber)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/70">
          <MapPin className={cn("h-3 w-3", coord ? "text-emerald-400" : "text-yellow-400")} />
          {coord ? "GPS ok" : "buscando GPS..."}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === "capture" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-lg">
                <Camera className="h-10 w-10 text-white" />
              </div>
              <h2 className="mt-4 text-lg font-black text-white">Tire a foto na porta</h2>
              <p className="mt-1 text-xs text-white/60">
                Enquadre a sacola, a fachada da casa ou a pessoa recebendo. A foto é sua prova
                caso o cliente conteste a entrega.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />

              <button
                onClick={() => inputRef.current?.click()}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-4 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30"
              >
                <Camera className="mr-2 inline h-5 w-5" /> Abrir câmera
              </button>

              {canSkip && (
                <button
                  onClick={() => setStep("skip")}
                  className="mt-3 w-full rounded-xl border border-white/10 py-3 text-xs font-bold text-white/60 hover:text-white/90"
                >
                  Não consigo tirar foto agora
                </button>
              )}
            </div>

            <BulletTips />
          </div>
        )}

        {step === "review" && photoPreview && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <img src={photoPreview} alt="Prova" className="w-full object-cover" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-emerald-300">
                  <Check className="mr-1 inline h-3 w-3" /> Foto capturada
                </span>
                <button
                  onClick={() => { setPhotoBlob(null); setPhotoPreview(null); setStep("capture"); }}
                  className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white"
                >
                  <RefreshCcw className="mr-1 inline h-3 w-3" /> Refazer
                </button>
              </div>
            </div>

            <ContactPicker
              value={contactType}
              onChange={setContactType}
              allowed={settings?.contact_types ?? []}
            />

            <div>
              <label className="text-[11px] font-bold uppercase text-white/60">
                Observação (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Entregue no portão azul, cliente confirmou..."
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-400 focus:outline-none"
                rows={3}
                maxLength={280}
              />
            </div>
          </div>
        )}

        {step === "skip" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-300" />
                <div className="text-xs text-yellow-100">
                  Sem foto, o pedido continua concluído mas fica marcado com o motivo abaixo.
                  Uso frequente pode ser revisado pelo gerente.
                </div>
              </div>
            </div>

            {needsReason && (
              <div>
                <label className="text-[11px] font-bold uppercase text-white/60">
                  Motivo *
                </label>
                <div className="mt-2 grid gap-2">
                  {(settings?.allowed_skip_reasons ?? []).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSkipReason(r)}
                      className={cn(
                        "rounded-xl border p-3 text-left text-sm",
                        skipReason === r
                          ? "border-fuchsia-400 bg-fuchsia-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    onClick={() => setSkipReason("__other__")}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm flex items-center gap-2",
                      skipReason === "__other__"
                        ? "border-fuchsia-400 bg-fuchsia-500/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/70",
                    )}
                  >
                    <Type className="h-4 w-4" /> Outro motivo (digitar)
                  </button>
                  {skipReason === "__other__" && (
                    <textarea
                      value={customSkip}
                      onChange={(e) => setCustomSkip(e.target.value)}
                      placeholder="Descreva o motivo..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30"
                      rows={2}
                      maxLength={200}
                    />
                  )}
                </div>
              </div>
            )}

            <ContactPicker
              value={contactType}
              onChange={setContactType}
              allowed={settings?.contact_types ?? []}
            />

            <button
              onClick={() => setStep("capture")}
              className="w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/70"
            >
              ← Voltar e tirar foto
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 p-4">
        {(step === "review" || step === "skip") && (
          <button
            onClick={submit}
            disabled={
              uploading ||
              (step === "skip" &&
                needsReason &&
                !((skipReason && skipReason !== "__other__") || customSkip.trim().length >= 3))
            }
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
          >
            {uploading ? (
              <><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Enviando prova...</>
            ) : (
              <><Check className="mr-2 inline h-5 w-5" /> Confirmar entrega</>
            )}
          </button>
        )}
      </footer>
    </div>
  );
}

function ContactPicker({
  value, onChange, allowed,
}: { value: string; onChange: (v: string) => void; allowed: string[] }) {
  const list = allowed.length ? allowed : Object.keys(CONTACT_LABELS);
  return (
    <div>
      <label className="text-[11px] font-bold uppercase text-white/60">
        Quem recebeu
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {list.map((k) => {
          const meta = CONTACT_LABELS[k] ?? { label: k, icon: Hand };
          const Icon = meta.icon;
          const active = value === k;
          return (
            <button
              key={k}
              onClick={() => onChange(k)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-bold",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/70",
              )}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BulletTips() {
  return (
    <ul className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-white/60">
      <li>• Foque o produto ou a fachada da casa, não o cliente sem consentimento.</li>
      <li>• Boa luz — usa flash à noite.</li>
      <li>• Se o cliente pediu sem contato, tire a foto do pacote na porta.</li>
    </ul>
  );
}

async function compressWithWatermark(
  file: File,
  opts: { quality: number; maxKb: number; watermark: boolean; lines: string[] },
): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);

  if (opts.watermark && opts.lines.length) {
    const pad = Math.round(w * 0.02);
    const fs = Math.max(12, Math.round(w * 0.022));
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    const lineH = fs * 1.35;
    const bgH = lineH * opts.lines.length + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - bgH, w, bgH);
    ctx.fillStyle = "#fff";
    opts.lines.forEach((t, i) => {
      ctx.fillText(t, pad, h - bgH + pad + fs + i * lineH);
    });
  }

  // iterative compression to hit target kb
  let q = opts.quality;
  let blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", q));
  let tries = 0;
  while (blob.size / 1024 > opts.maxKb && q > 0.35 && tries < 6) {
    q -= 0.1;
    blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", q));
    tries++;
  }
  return blob;
}
