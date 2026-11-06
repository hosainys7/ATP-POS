import {
  Barcode,
  Banknote,
  Bike,
  Box,
  CreditCard,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createQuickRepair,
  createSale,
  getProductByBarcode,
  getProducts,
  getReadyRepairs,
} from "../services/api";
import { printSaleReceipt } from "../utils/receipts";
import type { Product } from "../types/product";
import type { Repair } from "../types/repair";
import type { CartItem, RepairCartItem, Sale } from "../types/sale";

const tabs = ["Tous", "Pièces", "Trottinettes", "Accessoires", "Réparations"] as const;
type MenuTab = (typeof tabs)[number];

function repairNumber(id: number) {
  return `R-${String(id).padStart(5, "0")}`;
}

function productGroup(product: Product): MenuTab {
  const type = String(product.product_type || "Pièce détachée").toLowerCase();
  if (type.includes("trott")) return "Trottinettes";
  if (type.includes("access")) return "Accessoires";
  return "Pièces";
}

export default function SalePage() {
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<MenuTab>("Tous");
  const [products, setProducts] = useState<Product[]>([]);
  const [readyRepairs, setReadyRepairs] = useState<Repair[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [repairCart, setRepairCart] = useState<RepairCartItem[]>([]);
  const [payment, setPayment] = useState<"Espèces" | "Carte">("Espèces");
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [quickRepairOpen, setQuickRepairOpen] = useState(false);
  const [quickRepairSaving, setQuickRepairSaving] = useState(false);
  const [quickRepair, setQuickRepair] = useState({
    clientName: "",
    phone: "",
    brand: "",
    model: "",
    problem: "",
    repairDetails: "",
    partsCost: 0,
    laborCost: 0,
  });
  const scanRef = useRef<HTMLInputElement>(null);

  async function loadMenu() {
    try {
      const [productData, repairData] = await Promise.all([getProducts(), getReadyRepairs()]);
      setProducts(productData);
      setReadyRepairs(repairData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la caisse");
    }
  }

  useEffect(() => { loadMenu(); }, []);

  const productTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );
  const repairTotal = useMemo(
    () => repairCart.reduce((sum, item) => sum + item.total, 0),
    [repairCart]
  );
  const total = productTotal + repairTotal;
  const lineCount = cart.length + repairCart.length;
  const unitCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const received = payment === "Espèces" && cashReceived !== "" ? Number(cashReceived) : total;
  const change = payment === "Espèces" && Number.isFinite(received) ? Math.max(0, received - total) : 0;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesTab = activeTab === "Tous" || productGroup(product) === activeTab;
      if (!matchesTab) return false;
      const haystack = [
        product.name,
        product.barcode,
        product.category,
        product.brand,
        product.model,
        product.reference,
      ].filter(Boolean).join(" ").toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [products, search, activeTab]);

  function addProduct(product: Product) {
    setError("");
    if (Number(product.quantity) <= 0) {
      setError(`${product.name} est en rupture de stock`);
      return;
    }
    setCart((current) => {
      const existing = current.find((x) => x.productId === product.id);
      if (existing) {
        if (existing.quantity >= Number(product.quantity)) {
          setError(`Stock maximum atteint pour ${product.name}`);
          return current;
        }
        return current.map((x) => x.productId === product.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...current, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: Number(product.sell_price),
        availableStock: Number(product.quantity),
        productType: product.product_type,
        category: product.category,
        brand: product.brand,
        model: product.model,
      }];
    });
  }

  async function addByBarcode() {
    const barcode = scan.trim();
    if (!barcode) return;
    setError("");
    try {
      const product = await getProductByBarcode(barcode);
      addProduct(product);
      setScan("");
      scanRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Produit introuvable");
    }
  }

  function changeQty(productId: number, delta: number) {
    setCart((current) => current
      .map((item) => {
        if (item.productId !== productId) return item;
        const next = item.quantity + delta;
        if (next > item.availableStock) {
          setError(`Stock maximum atteint pour ${item.name}`);
          return item;
        }
        return { ...item, quantity: next };
      })
      .filter((item) => item.quantity > 0));
  }

  function addRepair(repair: Repair) {
    if (repairCart.some((item) => item.repairId === repair.id)) return;
    setRepairCart((current) => [...current, {
      repairId: repair.id,
      label: `Réparation ${repairNumber(repair.id)}`,
      clientName: repair.client_name,
      scooter: [repair.brand, repair.model].filter(Boolean).join(" "),
      total: Number(repair.total || 0),
    }]);
  }

  async function saveQuickRepair(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setQuickRepairSaving(true);
    try {
      const repair = await createQuickRepair(quickRepair);
      addRepair(repair);
      setReadyRepairs((current) => [repair, ...current]);
      setQuickRepairOpen(false);
      setQuickRepair({ clientName: "", phone: "", brand: "", model: "", problem: "", repairDetails: "", partsCost: 0, laborCost: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter la réparation");
    } finally {
      setQuickRepairSaving(false);
    }
  }

  function clearCart() {
    if (!lineCount) return;
    if (!window.confirm("Vider le panier en cours ? Aucune vente ne sera enregistrée.")) return;
    setCart([]);
    setRepairCart([]);
    setCashReceived("");
    setLastSale(null);
    setError("");
    scanRef.current?.focus();
  }

  async function completeSale() {
    if (!lineCount) return;
    if (payment === "Espèces" && cashReceived !== "" && Number(cashReceived) < total) {
      setError("Le montant reçu est inférieur au total à payer");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const sale = await createSale(
        cart.map((x) => ({ productId: x.productId, quantity: x.quantity })),
        payment,
        repairCart.map((x) => ({ repairId: x.repairId })),
        payment === "Espèces" ? (cashReceived === "" ? total : Number(cashReceived)) : null
      );
      setLastSale(sale);
      setCart([]);
      setRepairCart([]);
      setCashReceived("");
      setScan("");
      await loadMenu();
      scanRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la vente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="atp-kicker text-xs">Caisse</p>
          <h1 className="mt-0.5 text-slate-950">Nouvelle vente</h1>
          <p className="mt-0.5 text-xs text-slate-500">Scanner, sélectionner, encaisser. Pièces, trottinettes, accessoires et réparations dans le même ticket.</p>
        </div>
        {lineCount > 0 && (
          <button onClick={clearCart} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Vider le panier
          </button>
        )}
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-3 atp-responsive-grid">
        <div className="min-w-0 space-y-3">
          <section className="atp-card p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="relative">
                <Barcode className="absolute left-3 top-2.5 text-[#b96700]" size={17} />
                <input
                  ref={scanRef}
                  autoFocus
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addByBarcode(); } }}
                  placeholder="Scanner le code-barres…"
                  className="atp-input w-full border border-slate-200 py-2.5 pl-10 pr-3"
                />
              </div>
              <button onClick={addByBarcode} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">Ajouter</button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, marque, modèle, référence…" className="atp-input w-full border border-slate-200 py-2.5 pl-9 pr-3" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {tab === "Pièces" && <Package size={13} />}
                    {tab === "Trottinettes" && <Bike size={13} />}
                    {tab === "Accessoires" && <Box size={13} />}
                    {tab === "Réparations" && <Wrench size={13} />}
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="atp-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <div>
                <h2 className="text-slate-950">Menu caisse</h2>
                <p className="mt-0.5 text-[11px] text-slate-400">{activeTab === "Réparations" ? `${readyRepairs.length} réparation(s) prête(s) à encaisser` : `${visibleProducts.length} article(s) disponible(s)`}</p>
              </div>
              {activeTab === "Réparations" && (
                <button onClick={() => setQuickRepairOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold text-orange-700 hover:bg-orange-100">
                  <Plus size={13} /> Réparation rapide
                </button>
              )}
            </div>

            {activeTab === "Réparations" ? (
              <div className="atp-pos-menu p-3">
                {!readyRepairs.length ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-5 py-7 text-center">
                    <Wrench className="mx-auto text-slate-300" size={25} />
                    <div className="mt-2 text-sm font-bold text-slate-700">Aucun dossier prêt à encaisser</div>
                    <p className="mt-1 text-xs text-slate-400">Terminez une réparation dans Atelier, ou créez une intervention rapide.</p>
                    <button onClick={() => setQuickRepairOpen(true)} className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white">Réparation rapide</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 atp-menu-grid">
                    {readyRepairs.map((repair) => {
                      const added = repairCart.some((x) => x.repairId === repair.id);
                      return (
                        <button key={repair.id} disabled={added} onClick={() => addRepair(repair)} className="atp-pos-card disabled:cursor-not-allowed disabled:opacity-45">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-orange-700">{repairNumber(repair.id)}</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Prête</span>
                          </div>
                          <div className="mt-2 truncate text-sm font-bold text-slate-950">{repair.client_name || "Client comptoir"}</div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-400">{[repair.brand, repair.model].filter(Boolean).join(" ") || repair.problem || "Réparation"}</div>
                          <div className="mt-3 flex items-end justify-between">
                            <span className="text-base font-black">{Number(repair.total).toFixed(2)} €</span>
                            <span className="text-[10px] font-semibold text-slate-400">{added ? "Au panier" : "+ Ajouter"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="atp-pos-menu grid grid-cols-4 gap-2.5 p-3 atp-menu-grid">
                {visibleProducts.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-slate-400">Aucun article dans cette catégorie.</div>
                ) : visibleProducts.map((product) => (
                  <button key={product.id} onClick={() => addProduct(product)} disabled={Number(product.quantity) <= 0} className="atp-pos-card group disabled:cursor-not-allowed disabled:opacity-45">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">{productGroup(product)}</span>
                      <span className={`text-[9px] font-bold ${Number(product.quantity) <= 0 ? "text-red-600" : Number(product.quantity) <= Number(product.minimum_stock) ? "text-amber-600" : "text-emerald-600"}`}>{Number(product.quantity) <= 0 ? "Rupture" : `Stock ${product.quantity}`}</span>
                    </div>
                    <div className="mt-2 line-clamp-2 min-h-[34px] text-[13px] font-bold leading-4 text-slate-950">{product.name}</div>
                    <div className="mt-1 truncate text-[10px] text-slate-400">{[product.brand, product.model].filter(Boolean).join(" · ") || product.category || product.reference || product.barcode}</div>
                    <div className="mt-2 truncate text-[9px] text-slate-400">{product.reference ? `Réf. ${product.reference}` : product.category || "Article"}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-black text-slate-950">{Number(product.sell_price).toFixed(2)} €</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white transition group-hover:bg-orange-500"><Plus size={14} /></span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="atp-checkout h-fit lg:sticky lg:top-[74px]">
          <div className="atp-checkout-head flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">Panier & encaissement</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-600">
                {lineCount ? `${lineCount} ligne(s) · ${unitCount} produit(s) · ${repairCart.length} service(s)` : "Panier vide"}
              </div>
            </div>
            <ShoppingCart size={19} className="text-slate-400" />
          </div>

          <div className="atp-checkout-cart">
            {!lineCount ? (
              <div className="atp-checkout-empty">
                <ShoppingCart size={22} />
                <div>
                  <div className="font-bold text-slate-700">Panier vide</div>
                  <div className="text-[11px] text-slate-400">Scannez ou sélectionnez un article.</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={`p-${item.productId}`} className="atp-checkout-line">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-950">{item.name}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">{item.productType || "Produit"} · {item.barcode}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.unitPrice.toFixed(2)} € / unité</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(item.productId, -1)} className="atp-qty-btn"><Minus size={12} /></button>
                      <b className="min-w-5 text-center text-xs">{item.quantity}</b>
                      <button onClick={() => changeQty(item.productId, 1)} className="atp-qty-btn"><Plus size={12} /></button>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-950">{(item.unitPrice * item.quantity).toFixed(2)} €</div>
                      <button onClick={() => setCart((c) => c.filter((x) => x.productId !== item.productId))} className="mt-1 text-[10px] font-bold text-red-500 hover:text-red-700">Supprimer</button>
                    </div>
                  </div>
                ))}
                {repairCart.map((item) => (
                  <div key={`r-${item.repairId}`} className="atp-checkout-line atp-checkout-service-line">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate font-bold text-slate-950"><Wrench size={13} className="text-orange-600" /> {item.label}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">{item.clientName || "Client comptoir"} · {item.scooter || "Réparation"}</div>
                    </div>
                    <div className="text-center">
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-[9px] font-bold text-orange-700">SERVICE</span>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-950">{item.total.toFixed(2)} €</div>
                      <button onClick={() => setRepairCart((c) => c.filter((x) => x.repairId !== item.repairId))} className="mt-1 text-[10px] font-bold text-red-500 hover:text-red-700">Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="atp-checkout-summary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="atp-summary-chip">Produits <b>{productTotal.toFixed(2)} €</b></span>
              <span className="atp-summary-chip">Services <b>{repairTotal.toFixed(2)} €</b></span>
            </div>
            <div className="atp-checkout-total-row">
              <span>Total à payer</span>
              <strong>{total.toFixed(2)} €</strong>
            </div>
          </div>

          <div className="atp-checkout-payment">
            <div className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">Mode de paiement</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PaymentButton active={payment === "Espèces"} onClick={() => setPayment("Espèces")} icon={<Banknote size={17} />} label="Espèces" />
              <PaymentButton active={payment === "Carte"} onClick={() => { setPayment("Carte"); setCashReceived(""); }} icon={<CreditCard size={17} />} label="Carte" />
            </div>

            {payment === "Espèces" && lineCount > 0 && (
              <div className="atp-cash-row">
                <label className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Montant reçu</span>
                  <input type="number" min={0} step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={total.toFixed(2)} className="atp-input mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-base font-bold" />
                </label>
                <div className="atp-change-box">
                  <span>Monnaie</span>
                  <b>{change.toFixed(2)} €</b>
                </div>
              </div>
            )}
          </div>

          {lastSale && (
            <div className="atp-last-sale">
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase text-emerald-700">Dernière vente</div>
                <div className="truncate text-[11px] font-semibold text-slate-700">{lastSale.sale_number} · {Number(lastSale.total).toFixed(2)} €</div>
              </div>
              <button onClick={() => printSaleReceipt(lastSale)} className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"><Printer size={13} /> Reçu</button>
            </div>
          )}

          <div className="atp-checkout-footer">
            <button disabled={!lineCount || saving} onClick={completeSale} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-35">
              {saving ? "Enregistrement…" : `Valider la vente${lineCount ? ` · ${total.toFixed(2)} €` : ""}`}
            </button>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[9px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Stock mis à jour après validation
            </div>
          </div>
        </aside>
      </div>

      {quickRepairOpen && (
        <div className="atp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveQuickRepair} className="atp-modal-panel flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="atp-modal-header flex shrink-0 items-start justify-between border-b border-slate-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Réparation rapide</p>
                <h2 className="mt-0.5 text-slate-950">Ajouter directement au panier</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Intervention au comptoir non enregistrée auparavant.</p>
              </div>
              <button type="button" onClick={() => setQuickRepairOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="atp-modal-body min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label="Client (optionnel)"><input value={quickRepair.clientName} onChange={(e) => setQuickRepair({ ...quickRepair, clientName: e.target.value })} className="atp-input w-full border px-3 py-2" placeholder="Nom du client" /></Field>
                <Field label="Téléphone (optionnel)"><input value={quickRepair.phone} onChange={(e) => setQuickRepair({ ...quickRepair, phone: e.target.value })} className="atp-input w-full border px-3 py-2" /></Field>
                <Field label="Marque"><input value={quickRepair.brand} onChange={(e) => setQuickRepair({ ...quickRepair, brand: e.target.value })} className="atp-input w-full border px-3 py-2" placeholder="Xiaomi, KuKirin…" /></Field>
                <Field label="Modèle"><input value={quickRepair.model} onChange={(e) => setQuickRepair({ ...quickRepair, model: e.target.value })} className="atp-input w-full border px-3 py-2" placeholder="M365, G2 Pro…" /></Field>
                <Field label="Problème / service" span><input value={quickRepair.problem} onChange={(e) => setQuickRepair({ ...quickRepair, problem: e.target.value })} className="atp-input w-full border px-3 py-2" placeholder="Ex. remplacement pneu" /></Field>
                <Field label="Travail effectué (optionnel)" span><input value={quickRepair.repairDetails} onChange={(e) => setQuickRepair({ ...quickRepair, repairDetails: e.target.value })} className="atp-input w-full border px-3 py-2" /></Field>
                <Field label="Pièces (€)"><input type="number" min="0" step="0.01" value={quickRepair.partsCost} onChange={(e) => setQuickRepair({ ...quickRepair, partsCost: Number(e.target.value) })} className="atp-input w-full border px-3 py-2" /></Field>
                <Field label="Main-d'œuvre (€)"><input type="number" min="0" step="0.01" value={quickRepair.laborCost} onChange={(e) => setQuickRepair({ ...quickRepair, laborCost: Number(e.target.value) })} className="atp-input w-full border px-3 py-2" /></Field>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2.5">
                <span className="text-xs font-bold text-orange-700">Total réparation</span>
                <b className="text-lg text-slate-950">{(Number(quickRepair.partsCost) + Number(quickRepair.laborCost)).toFixed(2)} €</b>
              </div>
            </div>

            <div className="atp-modal-footer flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white">
              <button type="button" onClick={() => setQuickRepairOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Annuler</button>
              <button disabled={quickRepairSaving} type="submit" className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold text-white disabled:opacity-50">{quickRepairSaving ? "Ajout…" : "Ajouter au panier"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function PaymentButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition ${active ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{icon}{label}</button>;
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><b className="text-slate-800">{value.toFixed(2)} €</b></div>;
}

function Field({ label, children, span = false }: { label: string; children: ReactNode; span?: boolean }) {
  return <label className={span ? "sm:col-span-2" : ""}><span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span>{children}</label>;
}
