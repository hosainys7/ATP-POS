import {
  AlertTriangle,
  Barcode,
  Boxes,
  Eye,
  PackagePlus,
  PackageSearch,
  PackageX,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addStock,
  createProduct,
  getProductByBarcode,
  getProducts,
  updateProduct,
} from "../services/api";
import type { Product } from "../types/product";
import {
  INVENTORY_CATEGORIES,
  PRODUCT_TYPES,
  WEBSITE_BRANDS,
  WEBSITE_SCOOTER_MODELS,
} from "../data/catalog";

type ProductForm = {
  name: string;
  barcode: string;
  productType: string;
  brand: string;
  model: string;
  reference: string;
  category: string;
  compatibleModels: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  minimumStock: number;
};

const emptyForm: ProductForm = {
  name: "",
  barcode: "",
  productType: "Pièce détachée",
  brand: "",
  model: "",
  reference: "",
  category: "",
  compatibleModels: "",
  quantity: 1,
  buyPrice: 0,
  sellPrice: 0,
  minimumStock: 3,
};

function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    barcode: product.barcode,
    productType: product.product_type || "Pièce détachée",
    brand: product.brand || "",
    model: product.model || "",
    reference: product.reference || "",
    category: product.category || "",
    compatibleModels: product.compatible_models || "",
    quantity: 1,
    buyPrice: Number(product.buy_price || 0),
    sellPrice: Number(product.sell_price || 0),
    minimumStock: Number(product.minimum_stock || 0),
  };
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [scanCode, setScanCode] = useState("");
  const [identified, setIdentified] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState(1);
  const [editor, setEditor] = useState<{ mode: "new" | "edit"; product?: Product } | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  async function loadProducts() {
    try {
      setProducts(await getProducts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }

  useEffect(() => {
    loadProducts();
    scanRef.current?.focus();
  }, []);

  const totalUnits = useMemo(
    () => products.reduce((total, p) => total + Number(p.quantity || 0), 0),
    [products]
  );
  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.minimum_stock).length;
  const outOfStockCount = products.filter((p) => p.quantity <= 0).length;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const searchable = [
        p.name,
        p.barcode,
        p.category,
        p.brand,
        p.model,
        p.reference,
        p.compatible_models,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);
      const matchesStatus =
        filter === "all" ||
        (filter === "low" && p.quantity > 0 && p.quantity <= p.minimum_stock) ||
        (filter === "out" && p.quantity <= 0);
      const matchesType = typeFilter === "all" || (p.product_type || "Pièce détachée") === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [products, search, filter, typeFilter]);

  function clearScan() {
    setScanCode("");
    setIdentified(null);
    setMessage("");
    setError("");
    setTimeout(() => scanRef.current?.focus(), 50);
  }

  async function identifyBarcode() {
    const barcode = scanCode.trim();
    if (!barcode) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const product = await getProductByBarcode(barcode);
      setIdentified(product);
      setMessage("Produit identifié. Aucune modification n'a été effectuée.");
    } catch {
      setIdentified(null);
      setForm({ ...emptyForm, barcode });
      setEditor({ mode: "new" });
      setMessage("Code-barres inconnu : création d'un nouveau produit.");
    } finally {
      setLoading(false);
    }
  }

  function openNewProduct(barcode = "") {
    setForm({ ...emptyForm, barcode });
    setEditor({ mode: "new" });
    setError("");
  }

  function openEditProduct(product: Product) {
    setForm(productToForm(product));
    setEditor({ mode: "edit", product });
    setViewProduct(null);
    setError("");
  }

  function openAddStock(product: Product) {
    setStockProduct(product);
    setStockQty(1);
    setViewProduct(null);
    setError("");
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.barcode.trim()) {
      setError("Le nom et le code-barres sont obligatoires.");
      return;
    }
    if ([form.quantity, form.buyPrice, form.sellPrice, form.minimumStock].some((n) => Number(n) < 0)) {
      setError("Vérifiez les quantités et les prix.");
      return;
    }

    const details = {
      name: form.name,
      barcode: form.barcode,
      category: form.category,
      productType: form.productType,
      brand: form.brand,
      model: form.model,
      reference: form.reference,
      compatibleModels: form.compatibleModels,
      buyPrice: form.buyPrice,
      sellPrice: form.sellPrice,
      minimumStock: form.minimumStock,
    };

    setLoading(true);
    setError("");
    try {
      if (editor?.mode === "edit" && editor.product) {
        const updated = await updateProduct(editor.product.id, details);
        setMessage(`Fiche « ${updated.name} » mise à jour. Stock inchangé : ${updated.quantity}.`);
      } else {
        const created = await createProduct({ ...details, quantity: form.quantity });
        setMessage(`Nouveau produit « ${created.name} » enregistré avec un stock initial de ${created.quantity}.`);
      }
      setEditor(null);
      await loadProducts();
      clearScan();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le produit");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAddStock() {
    if (!stockProduct || !Number.isInteger(stockQty) || stockQty <= 0) {
      setError("La quantité doit être supérieure à 0.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await addStock(stockProduct.id, stockQty);
      setMessage(`Stock ajouté à « ${updated.name} » : +${stockQty}. Nouveau stock : ${updated.quantity}.`);
      setStockProduct(null);
      await loadProducts();
      if (identified?.id === updated.id) setIdentified(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter le stock");
    } finally {
      setLoading(false);
    }
  }

  const formIsScooter = form.productType === "Trottinette";
  const formIsPart = form.productType === "Pièce détachée";
  const formIsAccessory = form.productType === "Accessoire";

  function changeProductType(value: string) {
    setForm({
      ...form,
      productType: value,
      category: value === "Trottinette" ? "Trottinettes" : form.category === "Trottinettes" ? "" : form.category,
      model: form.model,
      compatibleModels: value === "Pièce détachée" ? form.compatibleModels : "",
    });
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="atp-kicker text-xs">Inventaire boutique</p>
          <h1 className="mt-0.5 text-slate-950">Stock & catalogue</h1>
          <p className="mt-0.5 text-xs text-slate-500">Références, quantités, prix et alertes de stock.</p>
        </div>
        <button onClick={() => openNewProduct()} className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600">
          <PackagePlus size={15} /> Ajouter un article
        </button>
      </header>

      <div className="atp-stat-strip">
        <CompactStat label="Références" value={products.length} icon={<Boxes size={16} />} />
        <CompactStat label="Unités en stock" value={totalUnits} icon={<PackageSearch size={16} />} />
        <CompactStat label="Stock faible" value={lowStockCount} icon={<AlertTriangle size={16} />} warn />
        <CompactStat label="Rupture" value={outOfStockCount} icon={<PackageX size={16} />} danger />
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <section className="atp-card p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <div className="relative">
            <Barcode size={17} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={scanRef}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); identifyBarcode(); } }}
              placeholder="Scanner / identifier un code-barres…"
              className="atp-input w-full border border-slate-200 py-2.5 pl-9 pr-3"
            />
          </div>
          <button onClick={identifyBarcode} disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Identifier</button>
          <button onClick={clearScan} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Effacer</button>
        </div>

        {identified && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-slate-900">{identified.name}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{identified.barcode} · Stock {identified.quantity} · {identified.category || "Sans catégorie"}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setViewProduct(identified)} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600"><Eye size={12} /> Voir</button>
              <button onClick={() => openAddStock(identified)} className="flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white"><Plus size={12} /> Stock</button>
            </div>
          </div>
        )}

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_180px_auto] gap-2 atp-responsive-grid">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code-barres, référence, nom, marque ou catégorie…" className="atp-input w-full border border-slate-200 py-2.5 pl-9 pr-3" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="atp-input border border-slate-200 bg-white px-3 py-2.5">
            <option value="all">Tous les types</option>{PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <div className="flex rounded-lg bg-slate-100 p-1">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Tous</FilterButton>
            <FilterButton active={filter === "low"} onClick={() => setFilter("low")}>Faible</FilterButton>
            <FilterButton active={filter === "out"} onClick={() => setFilter("out")}>Rupture</FilterButton>
          </div>
        </div>
      </section>

      <section className="atp-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="text-xs font-bold text-slate-700">{visibleProducts.length} référence{visibleProducts.length !== 1 ? "s" : ""}</div>
          <div className="text-[10px] text-slate-400">Cliquez sur Voir pour consulter une fiche sans modifier le stock.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="atp-table w-full min-w-[1080px]">
            <thead><tr><th className="px-4">Code-barres</th><th className="px-4">Référence</th><th className="px-4">Produit</th><th className="px-4">Marque</th><th className="px-4">Catégorie / variante</th><th className="px-4">Stock</th><th className="px-4">Achat</th><th className="px-4">Vente</th><th className="px-4">Statut</th><th className="px-4">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProducts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 font-mono text-[10px] text-slate-600">{p.barcode}</td>
                  <td className="px-4 text-xs font-semibold text-orange-700">{p.reference || "—"}</td>
                  <td className="px-4"><div className="text-xs font-bold text-slate-950">{p.name}</div><div className="mt-0.5 text-[9px] text-slate-400">{p.product_type || "Pièce détachée"}</div></td>
                  <td className="px-4 text-xs text-slate-600">{p.brand || "—"}</td>
                  <td className="px-4"><div className="text-xs text-slate-600">{p.category || "—"}</div><div className="mt-0.5 text-[9px] text-slate-400">{p.model || ""}</div></td>
                  <td className="px-4 text-sm font-black text-slate-900">{p.quantity}</td>
                  <td className="px-4 text-xs text-slate-600">{Number(p.buy_price).toFixed(2)} €</td>
                  <td className="px-4 text-xs font-bold text-slate-900">{Number(p.sell_price).toFixed(2)} €</td>
                  <td className="px-4"><StatusBadge product={p} /></td>
                  <td className="px-4"><div className="flex gap-1.5">
                    <button onClick={() => setViewProduct(p)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><Eye size={12} /> Voir</button>
                    <button onClick={() => openAddStock(p)} className="flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white"><Plus size={12} /> Stock</button>
                  </div></td>
                </tr>
              ))}
              {!visibleProducts.length && <tr><td colSpan={10} className="px-5 py-8 text-center text-xs text-slate-400">Aucun produit trouvé.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {viewProduct && (
        <Modal onClose={() => setViewProduct(null)} title="Fiche produit">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-950">{viewProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{viewProduct.product_type || "Pièce détachée"} · {viewProduct.category || "Sans catégorie"}</p>
              </div>
              <StatusBadge product={viewProduct} />
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
              <Info label="Code-barres" value={viewProduct.barcode} />
              <Info label="Référence" value={viewProduct.reference || "—"} />
              <Info label="Marque" value={viewProduct.brand || "—"} />
              <Info label="Catégorie" value={viewProduct.category || "—"} />
              <Info label={(viewProduct.product_type || "Pièce détachée") === "Trottinette" ? "Modèle" : "Spécification / variante"} value={viewProduct.model || "—"} />
              <Info label="Stock actuel" value={String(viewProduct.quantity)} strong />
              <Info label="Stock minimum" value={String(viewProduct.minimum_stock)} />
              <Info label="Prix achat" value={`${Number(viewProduct.buy_price).toFixed(2)} €`} />
              <Info label="Prix vente" value={`${Number(viewProduct.sell_price).toFixed(2)} €`} />
            </div>
            {viewProduct.compatible_models && <div><FieldLabel>Modèles compatibles</FieldLabel><p className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">{viewProduct.compatible_models}</p></div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => openEditProduct(viewProduct)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Modifier la fiche</button>
              <button onClick={() => openAddStock(viewProduct)} className="flex items-center gap-2 rounded-xl bg-[#f59e0b] px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:brightness-95"><Plus size={16} /> Ajouter du stock</button>
            </div>
          </div>
        </Modal>
      )}

      {stockProduct && (
        <Modal onClose={() => setStockProduct(null)} title="Réception de stock">
          <div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="font-extrabold text-slate-950">{stockProduct.name}</div>
              <div className="mt-1 text-sm text-slate-500">Stock actuel : <b>{stockProduct.quantity}</b> · Code : {stockProduct.barcode}</div>
            </div>
            <label className="mt-5 block">
              <FieldLabel>Quantité reçue</FieldLabel>
              <input autoFocus type="number" min="1" step="1" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} className="atp-input w-full rounded-xl border border-slate-200 p-3" />
            </label>
            {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setStockProduct(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={confirmAddStock} disabled={loading} className="rounded-xl bg-[#f59e0b] px-5 py-2.5 text-sm font-extrabold text-slate-950 disabled:opacity-50">Ajouter au stock</button>
            </div>
          </div>
        </Modal>
      )}

      {editor && (
        <Modal onClose={() => setEditor(null)} title={editor.mode === "new" ? "Ajouter un article au catalogue" : "Modifier la fiche article"} wide>
          <form onSubmit={saveProduct}>
            <p className="mb-5 text-sm text-slate-500">
              {editor.mode === "new"
                ? "Scannez d’abord le code-barres. Pour le stock, une référence différente (ex. CA-06, CA-13, CA-34) correspond à un article différent, même si la marque et la famille sont les mêmes."
                : "Vous modifiez seulement la fiche catalogue. La quantité en stock reste inchangée."}
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <label className="md:col-span-2">
                <FieldLabel>Code-barres</FieldLabel>
                <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="atp-input w-full rounded-xl border border-slate-200 p-3" placeholder="Scanner le code-barres..." />
              </label>
              <TextField label="Référence" value={form.reference} onChange={(value) => setForm({ ...form, reference: value })} placeholder="Ex. CA-13, réf. fournisseur..." />
              <SelectField label="Type d’article" value={form.productType} onChange={changeProductType} options={[...PRODUCT_TYPES]} />
              {editor.mode === "new" ? <NumberField label="Stock initial" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} /> : <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-400">Stock actuel</span><div className="mt-1 text-xl font-black">{editor.product?.quantity ?? 0}</div></div>}

              <label className="md:col-span-2">
                <FieldLabel>{formIsScooter ? "Nom / modèle de la trottinette" : formIsPart ? "Nom de la pièce" : "Nom de l’accessoire"}</FieldLabel>
                <input list={formIsScooter ? "website-models-stock" : undefined} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="atp-input w-full rounded-xl border border-slate-200 p-3" placeholder={formIsScooter ? "Ex. KuKirin G2" : formIsPart ? "Ex. Chambre à air 8,5 x 2" : "Ex. Antivol"} />
                <datalist id="website-models-stock">{WEBSITE_SCOOTER_MODELS.map((item) => <option key={item} value={item} />)}</datalist>
              </label>

              <label>
                <FieldLabel>Marque {formIsAccessory ? "(optionnel)" : ""}</FieldLabel>
                <input list="website-brands-stock" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="atp-input w-full rounded-xl border border-slate-200 p-3" placeholder="KuKirin, Xiaomi..." />
                <datalist id="website-brands-stock">{WEBSITE_BRANDS.map((item) => <option key={item} value={item} />)}</datalist>
              </label>

              {!formIsScooter && <label><FieldLabel>Catégorie</FieldLabel><input list="inventory-categories-stock" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="atp-input w-full rounded-xl border border-slate-200 p-3" placeholder={formIsPart ? "Chambres à air, pneus, freinage..." : "Casque, antivol, support..."} /><datalist id="inventory-categories-stock">{INVENTORY_CATEGORIES.map((item) => <option key={item} value={item} />)}</datalist></label>}
              <TextField label={formIsScooter ? "Modèle" : "Spécification / variante"} value={form.model} onChange={(value) => setForm({ ...form, model: value })} placeholder={formIsScooter ? "G2, M365..." : "Ex. 8,5 x 2 · valve 90° · diam. 140 mm"} />
              {formIsPart && <TextField label="Modèles compatibles (optionnel)" value={form.compatibleModels} onChange={(value) => setForm({ ...form, compatibleModels: value })} placeholder="Ex. M365, G2, G2 Max..." />}

              <NumberField label="Alerte stock minimum" value={form.minimumStock} onChange={(value) => setForm({ ...form, minimumStock: value })} />
              <NumberField label="Prix achat (€)" value={form.buyPrice} onChange={(value) => setForm({ ...form, buyPrice: value })} step="0.01" />
              <NumberField label="Prix vente (€)" value={form.sellPrice} onChange={(value) => setForm({ ...form, sellPrice: value })} step="0.01" />

              <div className="md:col-span-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {formIsScooter && <><b>Trottinette :</b> code-barres + référence + marque + modèle + prix + quantité.</>}
                {formIsPart && <><b>Pièce détachée :</b> code-barres + référence + nom + marque + catégorie + spécification. Les modèles compatibles restent optionnels.</>}
                {formIsAccessory && <><b>Accessoire :</b> code-barres + référence + nom + catégorie + prix + quantité. Marque et spécification seulement si utiles.</>}
              </div>
            </div>
            {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Annuler</button>
              <button type="submit" disabled={loading} className="rounded-xl bg-[#f59e0b] px-5 py-2.5 text-sm font-extrabold text-slate-950 disabled:opacity-50">{editor.mode === "new" ? "Enregistrer l’article" : "Enregistrer les modifications"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function CompactStat({ label, value, icon, warn = false, danger = false }: { label: string; value: number; icon: React.ReactNode; warn?: boolean; danger?: boolean }) {
  const tone = danger ? "text-red-600" : warn ? "text-amber-600" : "text-slate-500";
  return <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-xl font-black text-slate-950">{value}</div></div><span className={tone}>{icon}</span></div>;
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{children}</button>;
}

function StatusBadge({ product }: { product: Product }) {
  const state = product.quantity <= 0 ? "Rupture" : product.quantity <= product.minimum_stock ? "Stock faible" : "En stock";
  const stateClass = state === "Rupture" ? "bg-red-50 text-red-700" : state === "Stock faible" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stateClass}`}>{state}</span>;
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><div className="text-xs font-semibold text-slate-400">{label}</div><div className={`mt-1 text-sm ${strong ? "text-lg font-black text-slate-950" : "font-semibold text-slate-700"}`}>{value}</div></div>;
}
function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="atp-card p-5"><div className="flex items-center justify-between text-slate-400"><span className="text-sm font-semibold">{label}</span>{icon}</div><div className="mt-3 text-2xl font-black text-slate-950">{value}</div></div>;
}
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-sm font-bold text-slate-700">{children}</span>; }
function TextField({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label><FieldLabel>{label}</FieldLabel><input value={value} onChange={(e) => onChange(e.target.value)} className="atp-input w-full rounded-xl border border-slate-200 p-3" placeholder={placeholder} /></label>; }
function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) { return <label><FieldLabel>{label}</FieldLabel><input type="number" min="0" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="atp-input w-full rounded-xl border border-slate-200 p-3" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label><FieldLabel>{label}</FieldLabel><select value={value} onChange={(e) => onChange(e.target.value)} className="atp-input w-full rounded-xl border border-slate-200 bg-white p-3">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
