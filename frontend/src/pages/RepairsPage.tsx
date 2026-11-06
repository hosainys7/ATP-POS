import {
  CheckCircle2,
  Clock3,
  Printer,
  Search,
  Scooter,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createRepair,
  getRepairs,
  prepareRepair,
  updateRepairStatus,
} from "../services/api";
import type { Repair } from "../types/repair";
import type { PageName } from "../components/TopNav";
import { REPAIR_CATALOG, getRepairCategory } from "../data/repairCatalog";
import { printRepairDeposit, printRepairDelivery } from "../utils/receipts";

const firstCategory = REPAIR_CATALOG[0];
const emptyForm = {
  clientName: "",
  phone: "",
  brand: "",
  model: "",
  serialNumber: "",
  problem: "",
  receptionCondition: "",
  accessories: "",
  serviceCategory: firstCategory.label,
  serviceName: firstCategory.services[0].name,
  servicePriceHint: firstCategory.services[0].priceHint,
};

type RepairFilter = "Toutes" | "Reçue" | "En cours" | "Prête" | "Restituée";

function repairNumber(id: number) {
  return `R-${String(id).padStart(5, "0")}`;
}

function parseDatabaseDate(value: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusClass(status: string) {
  switch (status) {
    case "Reçue": return "atp-status-received";
    case "En cours": return "atp-status-progress";
    case "Prête": return "atp-status-ready";
    case "Restituée": return "atp-status-delivered";
    default: return "atp-status-delivered";
  }
}

export default function RepairsPage({ onNavigate }: { onNavigate: (page: PageName) => void }) {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RepairFilter>("Toutes");
  const [details, setDetails] = useState<Repair | null>(null);
  const [priceRepair, setPriceRepair] = useState<Repair | null>(null);
  const [repairAmount, setRepairAmount] = useState(0);

  async function load() {
    try {
      setRepairs(await getRepairs());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    received: repairs.filter((r) => r.status === "Reçue").length,
    inProgress: repairs.filter((r) => r.status === "En cours").length,
    ready: repairs.filter((r) => r.status === "Prête").length,
    delivered: repairs.filter((r) => r.status === "Restituée").length,
  }), [repairs]);

  const filteredRepairs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repairs.filter((repair) => {
      const matchesFilter = filter === "Toutes" || repair.status === filter;
      const haystack = [
        repairNumber(repair.id), repair.client_name, repair.phone, repair.brand,
        repair.model, repair.problem, repair.service_category, repair.service_name,
      ].join(" ").toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [repairs, search, filter]);

  const selectedCategory = getRepairCategory(form.serviceCategory);

  function selectCategory(label: string) {
    const category = getRepairCategory(label);
    const service = category.services[0];
    setForm({
      ...form,
      serviceCategory: category.label,
      serviceName: service.name,
      servicePriceHint: service.priceHint,
    });
  }

  function selectService(serviceName: string) {
    const service = selectedCategory.services.find((item) => item.name === serviceName);
    setForm({ ...form, serviceName, servicePriceHint: service?.priceHint || "" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const created = await createRepair({ ...form, serialNumber: "" });
      setForm(emptyForm);
      await load();
      printRepairDeposit(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la réception");
    }
  }

  async function setStatus(id: number, status: string) {
    try {
      await updateRepairStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le statut");
    }
  }

  function openPrice(repair: Repair) {
    setPriceRepair(repair);
    setRepairAmount(Number(repair.total || 0));
  }

  async function markReady() {
    if (!priceRepair) return;
    if (!Number.isFinite(repairAmount) || repairAmount <= 0) {
      setError("Saisissez le montant final de la réparation");
      return;
    }
    try {
      await prepareRepair(priceRepair.id, {
        diagnosis: "",
        repairDetails: "",
        partsCost: 0,
        laborCost: repairAmount,
      });
      setPriceRepair(null);
      setRepairAmount(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de marquer la réparation prête");
    }
  }

  return (
    <div className="space-y-4 atp-repairs-page">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="atp-kicker text-xs">Atelier</p>
          <h1 className="mt-0.5 text-slate-950">Réparations</h1>
          <p className="mt-0.5 text-xs text-slate-500">Réception rapide, suivi du statut et encaissement depuis la caisse.</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Reçue → En cours → Prête → Caisse → Restituée
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 atp-responsive-grid">
        <Metric title="Reçues" value={metrics.received} hint="À démarrer" icon={<Scooter size={18} />} tone="blue" active={filter === "Reçue"} onClick={() => setFilter(filter === "Reçue" ? "Toutes" : "Reçue")} />
        <Metric title="En réparation" value={metrics.inProgress} hint="Travail en cours" icon={<Wrench size={18} />} tone="amber" active={filter === "En cours"} onClick={() => setFilter(filter === "En cours" ? "Toutes" : "En cours")} />
        <Metric title="Prêtes à encaisser" value={metrics.ready} hint="À passer en caisse" icon={<CheckCircle2 size={18} />} tone="green" active={filter === "Prête"} onClick={() => setFilter(filter === "Prête" ? "Toutes" : "Prête")} />
        <Metric title="Restituées" value={metrics.delivered} hint="Payées & rendues" icon={<Clock3 size={18} />} tone="slate" active={filter === "Restituée"} onClick={() => setFilter(filter === "Restituée" ? "Toutes" : "Restituée")} />
      </div>

      <form onSubmit={submit} className="atp-card atp-workshop-intake overflow-hidden">
        <div className="atp-workshop-layout">
          <aside className="atp-service-rail">
            <div className="atp-service-rail-head">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-orange-600">Nouvelle réception</p>
                <h2 className="mt-1 text-slate-950">Choisir le service</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{form.serviceCategory}</span>
            </div>

            <div className="atp-service-list">
              {REPAIR_CATALOG.map((category) => {
                const active = form.serviceCategory === category.label;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => selectCategory(category.label)}
                    className={`atp-service-option ${active ? "is-active" : ""}`}
                  >
                    <span className="atp-service-option-badge">{category.label.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="atp-service-option-title">{category.label}</span>
                      <span className="atp-service-option-desc">{category.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="atp-intake-panel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-slate-950">Informations de réception</h2>
                <p className="mt-1 text-[13px] text-slate-500">Le client et le téléphone sont facultatifs. Notez seulement ce qui est utile à l’atelier.</p>
              </div>
              <div className="atp-price-hint">
                <span>Tarif indicatif</span>
                <strong>{form.servicePriceHint || "Selon intervention"}</strong>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] gap-3 atp-responsive-grid">
              <label>
                <span className="atp-field-label">Intervention / service</span>
                <select value={form.serviceName} onChange={(e) => selectService(e.target.value)} className="atp-input w-full border border-slate-200 bg-white px-3 py-3">
                  {selectedCategory.services.map((service) => <option key={service.name}>{service.name}</option>)}
                </select>
              </label>
              <div className="atp-selected-service">
                <span>Service sélectionné</span>
                <strong>{form.serviceName}</strong>
              </div>
            </div>

            <div className="atp-repair-form mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Nom du client (optionnel)" value={form.clientName} onChange={(v) => setForm({ ...form, clientName: v })} placeholder="Nom et prénom" />
              <Field label="Téléphone (optionnel)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="06 …" />
              <Field label="Marque (optionnel)" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="Xiaomi, KuKirin…" />
              <Field label="Modèle (optionnel)" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="M365, G2 Pro…" />

              <label className="md:col-span-2">
                <span className="atp-field-label">Problème signalé *</span>
                <textarea required value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="Ex. frein arrière ne fonctionne plus" className="atp-input w-full border border-slate-200 p-3" />
              </label>
              <label>
                <span className="atp-field-label">État à la réception</span>
                <textarea value={form.receptionCondition} onChange={(e) => setForm({ ...form, receptionCondition: e.target.value })} placeholder="Rayures, casse visible…" className="atp-input w-full border border-slate-200 p-3" />
              </label>
              <label>
                <span className="atp-field-label">Accessoires laissés</span>
                <textarea value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} placeholder="Chargeur, clés…" className="atp-input w-full border border-slate-200 p-3" />
              </label>
            </div>

            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-[12px] text-slate-400">Le dossier sera créé avec le statut <b className="text-slate-600">Reçue</b>.</p>
              <button className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600">Enregistrer la réception</button>
            </div>
          </div>
        </div>
      </form>

      <section className="atp-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-slate-950">Suivi des réparations</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">{filteredRepairs.length} dossier{filteredRepairs.length !== 1 ? "s" : ""} affiché{filteredRepairs.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Rechercher…" className="atp-input w-56 border border-slate-200 py-2 pl-9 pr-3"/></div>
            <select value={filter} onChange={(e) => setFilter(e.target.value as RepairFilter)} className="atp-input border border-slate-200 bg-white px-3 py-2"><option>Toutes</option><option>Reçue</option><option>En cours</option><option>Prête</option><option>Restituée</option></select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="atp-table w-full min-w-[1040px]">
            <thead><tr><th className="px-4 py-3">Dossier</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Trottinette</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Problème</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRepairs.map((repair) => {
                const created = parseDatabaseDate(repair.created_at);
                const client = repair.client_name?.trim() || "Client comptoir";
                const scooter = [repair.brand, repair.model].filter(Boolean).join(" ") || "—";
                return <tr key={repair.id}>
                  <td className="px-4 py-3"><div className="font-bold text-slate-900">{repairNumber(repair.id)}</div><div className="mt-0.5 text-[10px] text-slate-400">{created ? created.toLocaleDateString("fr-FR") : "—"}</div></td>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-900">{client}</div><div className="text-[10px] text-slate-400">{repair.phone || "—"}</div></td>
                  <td className="px-4 py-3 text-[13px] text-slate-600">{scooter}</td>
                  <td className="px-4 py-3"><div className="text-[13px] font-bold text-slate-800">{repair.service_category || "Réparation"}</div><div className="mt-0.5 text-[10px] text-orange-600">{repair.service_name || "—"}</div></td>
                  <td className="max-w-52 truncate px-4 py-3 text-[13px] text-slate-600" title={repair.problem}>{repair.problem}</td>
                  <td className="px-4 py-3"><span className={`atp-status ${statusClass(repair.status)}`}>{repair.status}</span></td>
                  <td className="px-4 py-3 text-[13px] font-bold text-slate-900">{Number(repair.total || 0).toFixed(2)} €</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setDetails(repair)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">Voir</button>
                    <button onClick={() => printRepairDeposit(repair)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"><Printer size={12} className="mr-1 inline" />Dépôt</button>
                    {repair.status === "Reçue" && <button onClick={() => setStatus(repair.id, "En cours")} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[12px] font-bold text-white">Démarrer</button>}
                    {repair.status === "En cours" && <button onClick={() => openPrice(repair)} className="rounded-md bg-orange-500 px-2.5 py-1.5 text-[12px] font-bold text-white">Terminer</button>}
                    {repair.status === "Prête" && <><button onClick={() => openPrice(repair)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-bold text-slate-600">Montant</button><button onClick={() => onNavigate("sale")} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[12px] font-bold text-white">Encaisser</button></>}
                    {repair.status === "Restituée" && <button onClick={() => printRepairDelivery(repair)} className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] font-bold text-white">Reçu final</button>}
                  </div></td>
                </tr>;
              })}
              {filteredRepairs.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-xs text-slate-400">Aucune réparation trouvée.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {details && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><div className="atp-compact-modal w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase text-orange-600">{repairNumber(details.id)}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{details.client_name || "Client comptoir"}</h2><p className="mt-0.5 text-xs text-slate-500">{[details.brand, details.model].filter(Boolean).join(" ") || "Trottinette non précisée"}</p></div><button onClick={() => setDetails(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Service</div><div className="mt-0.5 text-sm font-bold text-slate-950">{details.service_category || "Réparation"} · {details.service_name || "Non précisé"}</div></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Info label="Téléphone" value={details.phone || "—"}/><Info label="Statut" value={details.status}/><div className="col-span-2"><Info label="Problème signalé" value={details.problem}/></div><Info label="État à la réception" value={details.reception_condition || "—"}/><Info label="Accessoires laissés" value={details.accessories || "—"}/></div>
        {Number(details.total || 0) > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-3"><Info label="Montant réparation" value={`${Number(details.total || 0).toFixed(2)} €`}/></div>}
      </div></div>}

      {priceRepair && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase text-orange-600">{repairNumber(priceRepair.id)}</p><h2 className="mt-1 text-lg font-bold text-slate-950">Réparation terminée</h2><p className="mt-0.5 text-[11px] text-slate-500">Saisissez le montant final. Le dossier passera en « Prête à encaisser ».</p></div><button onClick={() => setPriceRepair(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
        <label className="mt-4 block"><span className="mb-1 block text-[11px] font-bold text-slate-600">Montant réparation (€)</span><input autoFocus type="number" min="0.01" step="0.01" value={repairAmount} onChange={(e)=>setRepairAmount(Number(e.target.value))} className="atp-input w-full border border-slate-200 p-3 text-xl font-bold"/></label>
        {priceRepair.service_price_hint && <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[10px] text-slate-500">Tarif indicatif : <b className="text-orange-700">{priceRepair.service_price_hint}</b></div>}
        <div className="mt-4 flex justify-end gap-2"><button onClick={() => setPriceRepair(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Annuler</button><button onClick={markReady} className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white">Prête à encaisser</button></div>
      </div></div>}
    </div>
  );
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label><span className="atp-field-label">{label}</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="atp-input w-full border border-slate-200 px-3 py-2.5"/></label>;
}

function Metric({ title, value, hint, icon, tone, active, onClick }: { title: string; value: number; hint: string; icon: React.ReactNode; tone: "blue" | "amber" | "green" | "slate"; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`atp-kpi atp-kpi-${tone} ${active ? "ring-1 ring-slate-300" : ""}`}>
      <div className="atp-kpi-head"><span className="atp-kpi-label">{title}</span><span className="atp-kpi-icon">{icon}</span></div>
      <div className="atp-kpi-value">{value}</div>
      <div className="atp-kpi-hint">{hint}</div>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-0.5 font-medium text-slate-800">{value}</div></div>;
}
