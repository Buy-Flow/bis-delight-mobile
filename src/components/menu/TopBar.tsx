import { Menu } from "lucide-react";
import { BRAND } from "@/data/menu";
import { AccountButton } from "./AccountButton";

export function TopBar({ onOpenCategories }: { onOpenCategories: () => void }) {


  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <div className="relative flex items-center justify-between px-4 py-3">
        <button
          onClick={onOpenCategories}
          aria-label="Categorias"
          className="grid h-11 w-11 place-items-center rounded-2xl bg-neon-pink text-white glow-pink active:scale-95 transition"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <img
            src={BRAND.logo}
            alt="Quero Bis — Sorveteria e Açaí"
            className="h-14 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <AccountButton />
        </div>

      </div>
    </header>
  );
}
