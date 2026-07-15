import { useEffect, useState } from "react";
import {
  DEFAULT_ADMIN_THEME,
  loadAdminTheme,
  subscribeAdminTheme,
  themeToCss,
  type AdminTheme,
} from "@/lib/admin-theme";

/**
 * Injeta as CSS variables customizadas do painel admin, escopadas a
 * [data-scope="admin"]. Nunca afeta o site público.
 */
export function AdminThemeStyle() {
  const [theme, setTheme] = useState<AdminTheme>(DEFAULT_ADMIN_THEME);

  useEffect(() => {
    setTheme(loadAdminTheme());
    return subscribeAdminTheme(setTheme);
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />;
}
