import {
  Boxes,
  History,
  LayoutDashboard,
  Package,
  Save,
  ShoppingCart,
  Store,
  Wrench,
} from "lucide-react";

export type PageName =
  | "dashboard"
  | "sale"
  | "products"
  | "stock"
  | "history"
  | "repairs"
  | "backup";

type Props = {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
};

const menu = [
  { id: "dashboard" as const, label: "Accueil", icon: LayoutDashboard },
  { id: "sale" as const, label: "Nouvelle vente", icon: ShoppingCart },
  { id: "products" as const, label: "Produits", icon: Package },
  { id: "stock" as const, label: "Stock", icon: Boxes },
  { id: "history" as const, label: "Historique ventes", icon: History },
  { id: "repairs" as const, label: "Réparations", icon: Wrench },
  { id: "backup" as const, label: "Sauvegarde", icon: Save },
];

export default function Sidebar({ currentPage, onNavigate }: Props) {
  return (
    <aside className="atp-sidebar fixed left-0 top-0 z-40 flex h-screen w-64 flex-col text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="atp-brand-badge flex h-11 w-11 items-center justify-center rounded-2xl">
            <Store size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-tight">Atelier Trottinette Pro</div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">Vente · Réparation · Pièces</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                active
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="text-xs font-semibold text-slate-300">Propriétaire / Admin</div>
        <div className="mt-1 text-[11px] text-slate-500">Système local sécurisé</div>
      </div>
    </aside>
  );
}
