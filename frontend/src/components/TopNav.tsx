import {
  Archive,
  BarChart3,
  Boxes,
  Gauge,
  History,
  Package,
  ShoppingCart,
  Wrench,
} from "lucide-react";

export type PageName =
  | "dashboard"
  | "sale"
  | "products"
  | "stock"
  | "history"
  | "reports"
  | "repairs"
  | "backup";

type Props = {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
};

const items = [
  { id: "dashboard" as const, label: "Accueil", icon: Gauge },
  { id: "sale" as const, label: "Nouvelle vente", icon: ShoppingCart },
  { id: "products" as const, label: "Produits", icon: Package },
  { id: "stock" as const, label: "Stock", icon: Boxes },
  { id: "history" as const, label: "Historique", icon: History },
  { id: "reports" as const, label: "Rapports", icon: BarChart3 },
  { id: "repairs" as const, label: "Réparations", icon: Wrench },
  { id: "backup" as const, label: "Sauvegarde", icon: Archive },
];

export default function TopNav({ currentPage, onNavigate }: Props) {
  return (
    <header className="atp-topbar sticky top-0 z-40">
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-4 px-5 lg:px-7">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="atp-brand flex shrink-0 items-center gap-3 text-left"
          aria-label="Retour à l'accueil"
        >
          <span className="atp-brand-logo">
            <img src="/atp-logo.png" alt="Atelier Trottinette Pro" />
          </span>
          <span className="hidden leading-tight xl:block">
            <span className="block text-[14px] font-[750] tracking-[-0.01em] text-slate-950">Atelier Trottinette Pro</span>
            <span className="mt-0.5 block text-[9px] font-[750] uppercase tracking-[0.18em] text-slate-400">Gestion commerciale</span>
          </span>
        </button>

        <nav className="atp-nav-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            const sale = item.id === "sale";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`atp-nav-item ${sale ? "atp-nav-sale" : ""} ${active ? "is-active" : ""}`}
              >
                <Icon size={16.5} strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="atp-admin-chip hidden shrink-0 xl:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Local · Admin</span>
        </div>
      </div>
    </header>
  );
}
