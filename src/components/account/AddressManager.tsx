import { useState } from "react";
import { MapPin, Home, Briefcase, Star, Trash2, Plus, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { useUserAddresses, type UserAddress } from "@/lib/user-addresses";
import { geocodeAddress } from "@/lib/delivery-zone";
import { cn } from "@/lib/utils";

const LABEL_PRESETS = [
  { label: "Casa", icon: Home },
  { label: "Trabalho", icon: Briefcase },
  { label: "Outro", icon: MapPin },
];

function iconFor(label: string) {
  const p = LABEL_PRESETS.find((x) => x.label.toLowerCase() === label.toLowerCase());
  return p?.icon ?? MapPin;
}

export function AddressManager() {
  const { user } = useAuth();
  const { items, loading, create, update, remove, setDefault } = useUserAddresses(user?.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white">Meus endereços</div>
            <div className="text-[11px] text-white/60">Salve casa, trabalho e outros locais</div>
          </div>
        </div>
        {!showForm && !editingId && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-full bg-neon-pink px-3 py-1.5 text-[11px] font-extrabold text-white glow-pink active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/60">
          Nenhum endereço salvo ainda. Cadastre o primeiro para agilizar pedidos.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const Icon = iconFor(a.label);
            if (editingId === a.id) {
              return (
                <AddressForm
                  key={a.id}
                  initial={a}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (patch) => {
                    await update(a.id, patch);
                    setEditingId(null);
                    toast.success("Endereço atualizado");
                  }}
                />
              );
            }
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3 transition",
                  a.is_default
                    ? "border-neon-cyan/40 bg-neon-cyan/5"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{a.label}</span>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-cyan">
                        <Star className="h-2.5 w-2.5" /> padrão
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-white/80">{a.address}</div>
                  {a.reference && (
                    <div className="mt-0.5 text-[11px] text-white/50">Ref: {a.reference}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!a.is_default && (
                    <button
                      type="button"
                      onClick={async () => {
                        await setDefault(a.id);
                        toast.success("Endereço padrão atualizado");
                      }}
                      title="Definir como padrão"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-white/70 hover:bg-neon-cyan/15 hover:text-neon-cyan"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(a.id)}
                    title="Editar"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Remover "${a.label}"?`)) return;
                      await remove(a.id);
                      toast.success("Endereço removido");
                    }}
                    title="Remover"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-red-300/80 hover:bg-red-500/15 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="mt-3">
          <AddressForm
            onCancel={() => setShowForm(false)}
            onSubmit={async (input) => {
              await create(input);
              setShowForm(false);
              toast.success("Endereço salvo!");
            }}
          />
        </div>
      )}
    </div>
  );
}

function AddressForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: UserAddress;
  onSubmit: (input: {
    label: string;
    address: string;
    reference?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_default?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "Casa");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!address.trim()) {
      toast.error("Informe o endereço");
      return;
    }
    setSaving(true);
    try {
      // Best-effort geocode so checkout can skip re-geocoding later
      let lat: number | null = initial?.lat ?? null;
      let lng: number | null = initial?.lng ?? null;
      if (!initial || address.trim() !== initial.address) {
        try {
          const geo = await geocodeAddress(address);
          if (geo) {
            lat = geo.lat;
            lng = geo.lng;
          } else {
            lat = null;
            lng = null;
          }
        } catch {
          /* ignore */
        }
      }
      await onSubmit({
        label: label.trim() || "Casa",
        address: address.trim(),
        reference: reference.trim() || null,
        lat,
        lng,
        is_default: isDefault,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao salvar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-bold text-white">
          {initial ? "Editar endereço" : "Novo endereço"}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {LABEL_PRESETS.map((p) => {
          const Icon = p.icon;
          const active = label.toLowerCase() === p.label.toLowerCase();
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setLabel(p.label)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                active
                  ? "border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              )}
            >
              <Icon className="h-3 w-3" /> {p.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo (ex: Casa da mãe)"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-neon-cyan"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, número, bairro"
          autoComplete="street-address"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-neon-cyan"
        />
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Ponto de referência (opcional)"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-neon-cyan"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 accent-neon-cyan"
          />
          Usar como endereço padrão
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white active:scale-[.98]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-neon-pink px-3 py-2.5 text-sm font-extrabold text-white glow-pink active:scale-[.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
