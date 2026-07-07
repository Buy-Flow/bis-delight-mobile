import { BRAND } from "@/data/menu";
import { AccountButton } from "./AccountButton";

export function TopBar({ onOpenCategories: _onOpenCategories }: { onOpenCategories: () => void }) {


  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="h-11 w-11" />


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
