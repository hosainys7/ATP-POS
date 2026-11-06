import { Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/api";
import type { Product } from "../types/product";
import { PRODUCT_TYPES, WEBSITE_BRANDS } from "../data/catalog";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [brand, setBrand] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    getProducts().then(setProducts).catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const searchable = [p.name, p.barcode, p.category, p.brand, p.model, p.reference, p.compatible_models]
        .filter(Boolean).join(" ").toLowerCase();
      return (!q || searchable.includes(q))
        && (type === "all" || (p.product_type || "Pièce détachée") === type)
        && (brand === "all" || p.brand === brand);
    });
  }, [products, search, type, brand]);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="atp-kicker text-xs">Catalogue</p>
          <h1 className="mt-0.5 text-slate-950">Produits</h1>
          <p className="mt-0.5 text-xs text-slate-500">Trottinettes, pièces détachées et accessoires.</p>
        </div>
        <span className="atp-badge-orange rounded-full px-3 py-1.5 text-xs font-black">{products.length} références</span>
      </header>

      <div className="atp-card flex flex-wrap gap-2 p-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="atp-input w-full border border-slate-200 py-2.5 pl-10 pr-3" placeholder="Nom, référence, marque, modèle ou code-barres..." />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="atp-input border border-slate-200 bg-white px-3 py-2.5">
          <option value="all">Tous les types</option>{PRODUCT_TYPES.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="atp-input border border-slate-200 bg-white px-3 py-2.5">
          <option value="all">Toutes les marques</option>{WEBSITE_BRANDS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="atp-card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">{filtered.length} produit{filtered.length !== 1 ? "s" : ""}</div>
        <div className="overflow-x-auto">
          <table className="atp-table w-full text-left">
            <thead><tr><th className="px-4 py-2.5">Produit</th><th className="px-4 py-2.5">Marque / modèle</th><th className="px-4 py-2.5">Catégorie</th><th className="px-4 py-2.5">Code / réf.</th><th className="px-4 py-2.5">Stock</th><th className="px-4 py-2.5">Prix</th><th className="px-4 py-2.5">Statut</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const status = p.quantity <= 0 ? "Rupture" : p.quantity <= p.minimum_stock ? "Stock faible" : "En stock";
                const cls = status === "Rupture" ? "bg-red-50 text-red-700" : status === "Stock faible" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
                return <tr key={p.id}>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff4df] text-[#b96700]"><Package size={17} /></div><div><div className="text-sm font-black text-slate-950">{p.name}</div><div className="mt-0.5 text-[11px] text-slate-400">{p.product_type || "Pièce détachée"}</div></div></div></td>
                  <td className="px-4 py-2.5 text-xs text-slate-600"><b className="text-slate-800">{p.brand || "—"}</b><div className="text-xs text-slate-400">{p.model || "—"}</div></td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{p.category || "—"}</td>
                  <td className="px-4 py-2.5"><div className="font-mono text-xs text-slate-500">{p.reference || p.barcode}</div><div className="mt-0.5 font-mono text-[10px] text-slate-300">{p.reference ? p.barcode : ""}</div></td>
                  <td className="px-4 py-2.5 text-xs font-black">{p.quantity}</td>
                  <td className="px-4 py-2.5 text-xs font-black">{Number(p.sell_price).toFixed(2)} €</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${cls}`}>{status}</span></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">Aucun produit trouvé.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
