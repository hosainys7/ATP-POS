import { Eye, Printer, RotateCcw, Search, Undo2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cancelSale, createSaleReturn, getSaleById, getSales } from "../services/api";
import type { Sale, SaleItem, SaleSummary } from "../types/sale";
import { printSaleReceipt } from "../utils/receipts";

function parseDatabaseDate(value: string) {
  if (!value) return new Date(NaN);
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}
function euro(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0); }

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("Tous");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnItem, setReturnItem] = useState<SaleItem | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnPayment, setReturnPayment] = useState<"Espèces" | "Carte">("Espèces");
  const [returnReason, setReturnReason] = useState("Retour client");

  async function load() {
    setLoading(true); setError("");
    try { setSales(await getSales()); }
    catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger les ventes"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const saleDate = parseDatabaseDate(sale.created_at);
      const dateKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}-${String(saleDate.getDate()).padStart(2, "0")}`;
      return (!query || sale.sale_number.toLowerCase().includes(query)) &&
        (payment === "Tous" || sale.payment_method === payment) && (!date || dateKey === date);
    });
  }, [sales, search, payment, date]);

  const filteredTotal = filtered.reduce((sum, sale) => sum + Number((sale.net_total ?? (sale.status === "Annulée" ? 0 : sale.total)) || 0), 0);

  async function openSale(id: number) {
    setError("");
    try { setSelectedSale(await getSaleById(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Impossible d'ouvrir la vente"); }
  }

  async function handleCancel() {
    if (!selectedSale) return;
    const reason = window.prompt("Motif de l'annulation :", "Erreur de caisse");
    if (reason === null) return;
    if (!window.confirm(`Annuler ${selectedSale.sale_number} ? Le stock sera restauré.`)) return;
    try {
      await cancelSale(selectedSale.id, reason || "Erreur de caisse");
      setSelectedSale(await getSaleById(selectedSale.id));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d'annuler la vente"); }
  }

  async function submitReturn() {
    if (!selectedSale || !returnItem) return;
    try {
      await createSaleReturn(selectedSale.id, [{ saleItemId: returnItem.id, quantity: returnQty }], returnPayment, returnReason);
      setReturnItem(null);
      setSelectedSale(await getSaleById(selectedSale.id));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d'enregistrer le retour"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="atp-kicker text-xs">Ventes</p><h1 className="mt-0.5 text-slate-950">Historique des ventes</h1><p className="mt-0.5 text-xs text-slate-500">Consultez, réimprimez, corrigez ou remboursez sans supprimer l'historique.</p></div>
        <div className="text-right"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Total net affiché</div><div className="mt-1 text-2xl font-black">{euro(filteredTotal)}</div></div>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-[1fr_150px_160px] gap-2 atp-card p-3">
        <div className="relative"><Search className="absolute left-4 top-3.5 text-slate-400" size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par n° de vente..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:border-[#f59e0b]" /></div>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5"><option>Tous</option><option>Espèces</option><option>Carte</option></select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </div>

      <div className="atp-card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2.5 font-semibold">{filtered.length} vente{filtered.length !== 1 ? "s" : ""}</div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-2.5">N° vente</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Paiement</th><th className="px-4 py-2.5">Statut</th><th className="px-4 py-2.5">Total net</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Chargement...</td></tr> : filtered.map((sale) => (
            <tr key={sale.id} className="hover:bg-slate-50"><td className="px-4 py-2.5 font-bold">{sale.sale_number}</td><td className="px-4 py-2.5 text-xs text-slate-600">{parseDatabaseDate(sale.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td className="px-4 py-2.5 text-xs">{sale.payment_method}</td><td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${sale.status === "Annulée" ? "bg-red-50 text-red-700" : Number(sale.returned_total || 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{sale.status === "Annulée" ? "Annulée" : Number(sale.returned_total || 0) > 0 ? "Retour partiel" : "Validée"}</span></td><td className="px-4 py-2.5 font-bold">{euro(Number(sale.net_total ?? sale.total))}</td><td className="px-4 py-2.5 text-right"><button onClick={() => openSale(sale.id)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Eye size={15} /> Détails</button></td></tr>
          ))}
        </tbody></table></div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b p-4"><div><p className="text-xs font-black uppercase text-[#b96700]">Vente</p><h2 className="mt-1 text-2xl font-black">{selectedSale.sale_number}</h2><p className="mt-1 text-sm text-slate-400">{parseDatabaseDate(selectedSale.created_at).toLocaleString("fr-FR")}</p></div><button onClick={() => setSelectedSale(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="max-h-[62vh] overflow-y-auto p-4">
              {selectedSale.status === "Annulée" && <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">Vente annulée · {selectedSale.cancel_reason || "Erreur de caisse"}</div>}
              <div className="overflow-hidden rounded-xl border"><table className="w-full"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Article / Service</th><th className="px-3 py-2.5">Qté</th><th className="px-3 py-2.5">Prix</th><th className="px-4 py-3 text-right">Total</th><th className="px-3 py-2.5"></th></tr></thead><tbody className="divide-y">
                {selectedSale.items.map((item) => {
                  const remaining = Number(item.quantity) - Number(item.returned_quantity || 0);
                  return <tr key={`p-${item.id}`}><td className="px-3 py-2.5"><b>{item.product_name}</b><div className="text-xs text-slate-400">{item.barcode}</div></td><td className="px-3 py-2.5">{item.quantity}{item.returned_quantity ? <div className="text-[10px] font-bold text-amber-600">retourné : {item.returned_quantity}</div> : null}</td><td className="px-3 py-2.5">{euro(Number(item.unit_price))}</td><td className="px-4 py-3 text-right font-bold">{euro(Number(item.total))}</td><td className="px-4 py-3 text-right">{selectedSale.status !== "Annulée" && remaining > 0 && <button onClick={() => { setReturnItem(item); setReturnQty(1); setReturnPayment(selectedSale.payment_method === "Carte" ? "Carte" : "Espèces"); }} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-700">Retour</button>}</td></tr>;
                })}
                {(selectedSale.repair_items || []).map((item) => <tr key={`r-${item.id}`} className="bg-amber-50/40"><td className="px-3 py-2.5"><div className="flex items-center gap-2 font-semibold"><Wrench size={14} className="text-[#b96700]" />{item.description}</div></td><td className="px-3 py-2.5">1</td><td className="px-3 py-2.5">{euro(Number(item.unit_price))}</td><td className="px-4 py-3 text-right font-bold">{euro(Number(item.total))}</td><td /></tr>)}
              </tbody></table></div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">Paiement</span><b>{selectedSale.payment_method}</b></div>{selectedSale.payment_method === "Espèces" && selectedSale.cash_received != null && <><div className="mt-2 flex justify-between"><span className="text-slate-500">Reçu</span><b>{euro(Number(selectedSale.cash_received))}</b></div><div className="mt-2 flex justify-between"><span className="text-slate-500">Monnaie rendue</span><b>{euro(Number(selectedSale.change_due || 0))}</b></div></>}<div className="mt-3 flex justify-between border-t pt-3 text-xl font-black"><span>Total net</span><span>{euro(Number(selectedSale.net_total ?? selectedSale.total))}</span></div></div>
              {(selectedSale.returns || []).length > 0 && <div className="mt-4"><h3 className="text-sm font-black">Retours / remboursements</h3>{selectedSale.returns?.map((r) => <div key={r.id} className="mt-2 flex justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm"><span><b>{r.return_number}</b> · {r.reason}</span><b>-{euro(Number(r.total))}</b></div>)}</div>}
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t p-4"><div>{selectedSale.status !== "Annulée" && <button onClick={handleCancel} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 hover:bg-red-50"><Undo2 size={16} /> Annuler la vente</button>}</div><div className="flex gap-3"><button onClick={() => setSelectedSale(null)} className="rounded-xl border px-5 py-3 text-sm font-bold">Fermer</button><button onClick={() => printSaleReceipt(selectedSale)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"><Printer size={17} /> Réimprimer</button></div></div>
          </div>
        </div>
      )}

      {returnItem && selectedSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase text-amber-600">Retour / remboursement</p><h3 className="mt-1 text-xl font-black">{returnItem.product_name}</h3></div><button onClick={() => setReturnItem(null)}><X size={20} /></button></div>
            <label className="mt-5 block text-sm font-black">Quantité à retourner<input type="number" min="1" max={Math.max(1, Number(returnItem.quantity) - Number(returnItem.returned_quantity || 0))} value={returnQty} onChange={(e) => setReturnQty(Number(e.target.value))} className="mt-2 w-full rounded-xl border p-3" /></label>
            <label className="mt-4 block text-sm font-black">Mode de remboursement<select value={returnPayment} onChange={(e) => setReturnPayment(e.target.value as "Espèces" | "Carte")} className="mt-2 w-full rounded-xl border p-3"><option>Espèces</option><option>Carte</option></select></label>
            <label className="mt-4 block text-sm font-black">Motif<input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
            <div className="mt-5 rounded-xl bg-amber-50 p-4"><div className="flex justify-between"><span>Remboursement</span><b>{euro(returnQty * Number(returnItem.unit_price))}</b></div><p className="mt-1 text-xs text-amber-700">La quantité retournée sera remise automatiquement en stock.</p></div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setReturnItem(null)} className="rounded-xl border px-4 py-3 font-bold">Annuler</button><button onClick={submitReturn} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-black text-white"><RotateCcw size={16} /> Confirmer le retour</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
