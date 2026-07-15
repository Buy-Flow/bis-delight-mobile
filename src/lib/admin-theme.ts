// Painel admin theme — persisted em localStorage e injetado como <style>
// scoped a [data-scope="admin"]. Não afeta o site público.

export type AdminTheme = {
  brandName: string;
  brandKicker: string;
  background: string; // hex
  surface: string; // hex (cards / sidebar)
  border: string; // hex
  primary: string; // hex (botões / destaques)
  accent: string; // hex (neon amarelo / brand pulse)
  text: string; // hex
  mutedText: string; // hex
  radius: number; // px
  sidebarWidth: number; // px
  fontFamily: "system" | "inter" | "space-grotesk" | "sora" | "jetbrains-mono";
};

export const DEFAULT_ADMIN_THEME: AdminTheme = {
  brandName: "Quero Bis",
  brandKicker: "Painel",
  background: "#0b0512",
  surface: "#170826",
  border: "#ffffff1a",
  primary: "#ff2e93",
  accent: "#f5e14a",
  text: "#ffffff",
  mutedText: "#ffffffb3",
  radius: 16,
  sidebarWidth: 248,
  fontFamily: "system",
};

const KEY = "qb.admin-theme.v1";
const EVT = "qb:admin-theme:change";

export function loadAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return DEFAULT_ADMIN_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ADMIN_THEME;
    const parsed = JSON.parse(raw) as Partial<AdminTheme>;
    return { ...DEFAULT_ADMIN_THEME, ...parsed };
  } catch {
    return DEFAULT_ADMIN_THEME;
  }
}

export function saveAdminTheme(theme: AdminTheme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(theme));
  window.dispatchEvent(new CustomEvent(EVT, { detail: theme }));
}

export function resetAdminTheme() {
  saveAdminTheme(DEFAULT_ADMIN_THEME);
}

export function subscribeAdminTheme(cb: (t: AdminTheme) => void) {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => {
    const t = (e as CustomEvent<AdminTheme>).detail;
    if (t) cb(t);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb(loadAdminTheme());
  };
  window.addEventListener(EVT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

const FONT_STACKS: Record<AdminTheme["fontFamily"], string> = {
  system:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  "space-grotesk": "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  sora: "'Sora', ui-sans-serif, system-ui, sans-serif",
  "jetbrains-mono":
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

// Hex utilities so we can synthesize soft variants of the user's palette
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const int = parseInt(v, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function mix(hex: string, withHex: string, ratio: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const r = Math.round(a.r * (1 - ratio) + b.r * ratio);
  const g = Math.round(a.g * (1 - ratio) + b.g * ratio);
  const bl = Math.round(a.b * (1 - ratio) + b.b * ratio);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function themeToCss(t: AdminTheme) {
  const bg = t.background;
  const surface = t.surface;
  const primary = t.primary;
  const accent = t.accent;
  // Escape helper para selecionar classes Tailwind com [#hex]
  const primarySoft = rgba(primary, 0.15);
  const primaryStrong = mix(primary, "#000000", 0.15);
  const surfaceEle = mix(surface, "#ffffff", 0.04);
  return `
[data-scope="admin"]{
  --background: ${bg};
  --card: ${surface};
  --card-foreground: ${t.text};
  --popover: ${surface};
  --popover-foreground: ${t.text};
  --border: ${t.border};
  --input: ${t.border};
  --primary: ${primary};
  --primary-foreground: #ffffff;
  --secondary: ${surfaceEle};
  --secondary-foreground: ${t.text};
  --muted: ${surfaceEle};
  --muted-foreground: ${t.mutedText};
  --accent: ${accent};
  --accent-foreground: #0b0512;
  --neon-yellow: ${accent};
  --neon-yellow-soft: ${accent};
  --neon-pink: ${primary};
  --ring: ${primary};
  --radius: ${t.radius}px;
  color: ${t.text};
  font-family: ${FONT_STACKS[t.fontFamily]};
  background-color: ${bg};
}
[data-scope="admin"] .text-white\\/50,
[data-scope="admin"] .text-white\\/60,
[data-scope="admin"] .text-white\\/70,
[data-scope="admin"] .text-white\\/80{ color: ${t.mutedText} !important; }
[data-scope="admin"] aside.md\\:flex{ --qb-sidebar-w: ${t.sidebarWidth}px; }

/* === Overrides de cores fixas dos painéis (hardcoded hex do tema default) === */
[data-scope="admin"] .bg-\\[\\#0b0512\\],
[data-scope="admin"] [class*="bg-[#0b0512"]{ background-color: ${bg} !important; }
[data-scope="admin"] .bg-\\[\\#170826\\],
[data-scope="admin"] [class*="bg-[#170826"]{ background-color: ${surface} !important; }
[data-scope="admin"] .bg-\\[\\#1a0a2e\\]{ background-color: ${surfaceEle} !important; }
[data-scope="admin"] .from-\\[\\#0b0512\\]{ --tw-gradient-from: ${bg} !important; }
[data-scope="admin"] .to-\\[\\#170826\\]{ --tw-gradient-to: ${surface} !important; }
[data-scope="admin"] .from-\\[\\#170826\\]{ --tw-gradient-from: ${surface} !important; }
[data-scope="admin"] .text-\\[\\#ff2e93\\]{ color: ${primary} !important; }
[data-scope="admin"] .bg-\\[\\#ff2e93\\]{ background-color: ${primary} !important; }
[data-scope="admin"] .border-\\[\\#ff2e93\\]{ border-color: ${primary} !important; }
[data-scope="admin"] .text-\\[\\#f5e14a\\]{ color: ${accent} !important; }
[data-scope="admin"] .bg-\\[\\#f5e14a\\]{ background-color: ${accent} !important; }

/* === Overrides para paletas Tailwind usadas como "cor da marca" no painel === */
[data-scope="admin"] .bg-fuchsia-500,
[data-scope="admin"] .bg-fuchsia-600,
[data-scope="admin"] .bg-pink-500,
[data-scope="admin"] .bg-pink-600{ background-color: ${primary} !important; }
[data-scope="admin"] .text-fuchsia-400,
[data-scope="admin"] .text-fuchsia-500,
[data-scope="admin"] .text-pink-400,
[data-scope="admin"] .text-pink-500{ color: ${primary} !important; }
[data-scope="admin"] .border-fuchsia-500,
[data-scope="admin"] .border-fuchsia-500\\/40,
[data-scope="admin"] .border-pink-500,
[data-scope="admin"] .border-pink-500\\/40{ border-color: ${primary} !important; }
[data-scope="admin"] .from-fuchsia-500,
[data-scope="admin"] .from-fuchsia-600,
[data-scope="admin"] .from-pink-500,
[data-scope="admin"] .from-pink-600{ --tw-gradient-from: ${primary} !important; --tw-gradient-to: ${rgba(primary, 0)} !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
[data-scope="admin"] .to-fuchsia-500,
[data-scope="admin"] .to-fuchsia-600,
[data-scope="admin"] .to-pink-500,
[data-scope="admin"] .to-pink-600,
[data-scope="admin"] .to-purple-600{ --tw-gradient-to: ${primaryStrong} !important; }
[data-scope="admin"] .via-fuchsia-500,
[data-scope="admin"] .via-pink-500,
[data-scope="admin"] .via-purple-600{ --tw-gradient-via: ${primary} !important; --tw-gradient-stops: var(--tw-gradient-from), ${primary} var(--tw-gradient-via-position, 50%), var(--tw-gradient-to) !important; }
[data-scope="admin"] .bg-fuchsia-500\\/10,
[data-scope="admin"] .bg-fuchsia-500\\/15,
[data-scope="admin"] .bg-fuchsia-500\\/20,
[data-scope="admin"] .bg-pink-500\\/10,
[data-scope="admin"] .bg-pink-500\\/20{ background-color: ${primarySoft} !important; }

/* === Amarelo neon (accent) === */
[data-scope="admin"] .bg-yellow-300,
[data-scope="admin"] .bg-yellow-400,
[data-scope="admin"] .bg-amber-300,
[data-scope="admin"] .bg-amber-400{ background-color: ${accent} !important; }
[data-scope="admin"] .text-yellow-300,
[data-scope="admin"] .text-yellow-400,
[data-scope="admin"] .text-amber-300,
[data-scope="admin"] .text-amber-400{ color: ${accent} !important; }
[data-scope="admin"] .border-yellow-400\\/40,
[data-scope="admin"] .border-amber-400\\/40{ border-color: ${rgba(accent, 0.4)} !important; }

/* Garante que "bg-background" e cartões brancos herdem o tema mesmo com Tailwind bg-white residual */
[data-scope="admin"] .bg-white{ background-color: ${surface} !important; color: ${t.text} !important; }
[data-scope="admin"] .text-black{ color: ${t.text} !important; }
`;
}
