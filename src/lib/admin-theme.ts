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

export function themeToCss(t: AdminTheme) {
  return `
[data-scope="admin"]{
  --background: ${t.background};
  --card: ${t.surface};
  --card-foreground: ${t.text};
  --popover: ${t.surface};
  --popover-foreground: ${t.text};
  --border: ${t.border};
  --input: ${t.border};
  --primary: ${t.primary};
  --primary-foreground: #ffffff;
  --accent: ${t.accent};
  --accent-foreground: #0b0512;
  --neon-yellow: ${t.accent};
  --neon-yellow-soft: ${t.accent};
  --neon-pink: ${t.primary};
  --ring: ${t.primary};
  --radius: ${t.radius}px;
  color: ${t.text};
  font-family: ${FONT_STACKS[t.fontFamily]};
}
[data-scope="admin"] .text-white\\/60,
[data-scope="admin"] .text-white\\/70{ color: ${t.mutedText} !important; }
[data-scope="admin"] aside.md\\:flex{ --qb-sidebar-w: ${t.sidebarWidth}px; }
`;
}
