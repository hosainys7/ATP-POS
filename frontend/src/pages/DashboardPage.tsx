import {
  Banknote,
  Boxes,
  CalendarDays,
  CreditCard,
  PackageX,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getProducts, getRepairs, getSales } from "../services/api";
import type { Product } from "../types/product";
import type { Repair } from "../types/repair";
import type { SaleSummary } from "../types/sale";
import type { PageName } from "../components/TopNav";
import type { ReportPeriod } from "./ReportsPage";

function parseDatabaseDate(value: string) {
  if (!value) return new Date(NaN);
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function isSameLocalDay(date: Date, reference: Date) {
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage({ onNavigate, onOpenReports }: { onNavigate: (page: PageName) => void; onOpenReports: (period: ReportPeriod) => void }) {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [salesData, productsData, repairsData] = await Promise.all([getSales(), getProducts(), getRepairs()]);
      setSales(salesData);
      setProducts(productsData);
      setRepairs(repairsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le tableau de bord");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todaySales = sales.filter((sale) => isSameLocalDay(parseDatabaseDate(sale.created_at), now));
    const monthSales = sales.filter((sale) => {
      const d = parseDatabaseDate(sale.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const cashToday = todaySales.filter((s) => s.payment_method === "Espèces").reduce((a, s) => a + Number(s.total || 0), 0);
    const cardToday = todaySales.filter((s) => s.payment_method === "Carte").reduce((a, s) => a + Number(s.total || 0), 0);

    return {
      todayTotal: todaySales.reduce((a, s) => a + Number(s.total || 0), 0),
      monthTotal: monthSales.reduce((a, s) => a + Number(s.total || 0), 0),
      todayTransactions: todaySales.length,
      cashToday,
      cardToday,
      lowStock: products.filter((p) => p.quantity > 0 && p.quantity <= p.minimum_stock).length,
      outOfStock: products.filter((p) => p.quantity <= 0).length,
      activeRepairs: repairs.filter((r) => r.status !== "Restituée").length,
      receivedRepairs: repairs.filter((r) => r.status === "Reçue").length,
      inProgressRepairs: repairs.filter((r) => r.status === "En cours").length,
      readyRepairs: repairs.filter((r) => r.status === "Prête").length,
    };
  }, [sales, products, repairs]);

  const sevenDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() - (6 - index));
      const total = sales
        .filter((sale) => dayKey(parseDatabaseDate(sale.created_at)) === dayKey(d))
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
      return { label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), total };
    });
  }, [sales]);

  const recentSales = sales.slice(0, 5);
  const urgentProducts = products.filter((p) => p.quantity <= p.minimum_stock).sort((a, b) => a.quantity - b.quantity).slice(0, 5);
  const paymentTotal = stats.cashToday + stats.cardToday;
  const cashPct = paymentTotal ? Math.round((stats.cashToday / paymentTotal) * 100) : 0;
  const cardPct = paymentTotal ? 100 - cashPct : 0;
  const stockOk = products.filter((p) => p.quantity > p.minimum_stock).length;
  const sevenDayTotal = sevenDays.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="atp-kicker text-xs">Vue d'ensemble</p>
          <h1 className="mt-0.5 text-slate-950">Accueil</h1>
          <p className="mt-1 text-sm text-slate-500">Indicateurs clés et activité récente du magasin.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-4 gap-2.5 atp-responsive-grid">
        <Metric title="Ventes aujourd'hui" value={euro(stats.todayTotal)} hint="Rapport du jour" icon={<CalendarDays size={18} />} tone="green" onClick={() => onOpenReports("today")} />
        <Metric title="Ventes du mois" value={euro(stats.monthTotal)} hint="Rapport du mois" icon={<TrendingUp size={18} />} tone="blue" onClick={() => onOpenReports("month")} />
        <Metric title="Transactions aujourd'hui" value={String(stats.todayTransactions)} hint="Voir l'historique" icon={<ShoppingCart size={18} />} tone="blue" onClick={() => onNavigate("history")} />
        <Metric title="Réparations actives" value={String(stats.activeRepairs)} hint={`${stats.receivedRepairs} reçue · ${stats.inProgressRepairs} en cours · ${stats.readyRepairs} prête`} icon={<Wrench size={18} />} tone="red" onClick={() => onNavigate("repairs")} />
      </div>

      <div className="grid grid-cols-[1.65fr_0.78fr_0.9fr] gap-3 atp-responsive-grid">
        <section className="atp-card cursor-pointer p-4" onClick={() => onOpenReports("7d")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-slate-950">Chiffre d'affaires · 7 jours</h2>
              <p className="mt-1 text-xs text-slate-400">Tendance des ventes enregistrées.</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-400">Total 7 jours</div>
              <div className="mt-1 text-xl font-[760] tracking-[-.03em] text-slate-950">{euro(sevenDayTotal)}</div>
            </div>
          </div>
          <div className="mt-2 h-[145px]"><SalesLineChart data={sevenDays} /></div>
        </section>

        <section className="atp-card p-4">
          <h2 className="text-slate-950">Paiements</h2>
          <p className="mt-1 text-xs text-slate-400">Répartition aujourd'hui.</p>
          <div className="mt-3 flex justify-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background: `conic-gradient(#16a34a 0 ${cashPct}%, #2563eb ${cashPct}% 100%)` }}>
              <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_#f1f5f9]">
                <div><div className="text-[16px] font-[760] tracking-[-.03em] text-slate-950">{euro(paymentTotal)}</div><div className="mt-0.5 text-[9px] font-bold uppercase tracking-[.09em] text-slate-400">Total</div></div>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <LegendDot color="#16a34a" label={`Espèces · ${cashPct}%`} value={euro(stats.cashToday)} icon={<Banknote size={14} />} />
            <LegendDot color="#2563eb" label={`Carte · ${cardPct}%`} value={euro(stats.cardToday)} icon={<CreditCard size={14} />} />
          </div>
        </section>

        <section className="atp-card cursor-pointer p-4" onClick={() => onNavigate("stock")}>
          <h2 className="text-slate-950">État du stock</h2>
          <p className="mt-1 text-xs text-slate-400">Disponibilité et alertes.</p>
          <div className="mt-3 space-y-2.5">
            <StockRow label="Disponible" value={stockOk} total={Math.max(products.length, 1)} tone="ok" />
            <StockRow label="Stock faible" value={stats.lowStock} total={Math.max(products.length, 1)} tone="warn" />
            <StockRow label="Rupture" value={stats.outOfStock} total={Math.max(products.length, 1)} tone="danger" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat icon={<TriangleAlert size={15} />} label="Faible" value={stats.lowStock} warning />
            <MiniStat icon={<PackageX size={15} />} label="Rupture" value={stats.outOfStock} danger />
          </div>
        </section>
      </div>

      {loading ? (
        <div className="atp-card p-10 text-center text-sm text-slate-400">Chargement...</div>
      ) : (
        <div className="grid grid-cols-[1.4fr_1fr] gap-3 atp-responsive-grid">
          <section className="atp-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div><h2 className="text-slate-950">Dernières ventes</h2><p className="mt-1 text-xs text-slate-400">Dernières opérations enregistrées.</p></div>
              <button type="button" onClick={() => onNavigate("history")} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Voir l'historique →</button>
            </div>
            {!recentSales.length ? <Empty text="Aucune vente enregistrée." /> : recentSales.map((sale) => (
              <div key={sale.id} className="grid grid-cols-[1fr_130px_110px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                <div><div className="text-sm font-[720] text-slate-900">{sale.sale_number}</div><div className="mt-0.5 text-[11px] text-slate-400">{parseDatabaseDate(sale.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div></div>
                <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{sale.payment_method}</span>
                <div className="text-right text-sm font-[740] text-slate-950">{euro(Number(sale.total))}</div>
              </div>
            ))}
          </section>

          <section className="atp-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Boxes size={16} className="text-slate-500" />
              <div><h2 className="text-slate-950">À surveiller</h2><p className="mt-1 text-xs text-slate-400">Stock faible ou rupture.</p></div>
            </div>
            {!urgentProducts.length ? <Empty text="Aucune alerte de stock." /> : urgentProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                <div className="min-w-0"><div className="truncate text-sm font-[700] text-slate-900">{product.name}</div><div className="mt-0.5 text-[11px] text-slate-400">Minimum : {product.minimum_stock}</div></div>
                <span className={`atp-status ${product.quantity <= 0 ? "atp-status-delivered !text-red-700 !bg-red-50 !border-red-200" : "atp-status-progress"}`}>{product.quantity <= 0 ? "Rupture" : `${product.quantity} restant${product.quantity > 1 ? "s" : ""}`}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, hint, icon, tone, onClick }: { title: string; value: string; hint?: string; icon: ReactNode; tone: "green" | "blue" | "red"; onClick?: () => void }) {
  const content = <>
    <div className="atp-kpi-head"><div className="atp-kpi-label">{title}</div><div className={`atp-kpi-icon ${tone === "green" ? "" : ""}`}>{icon}</div></div>
    <div className="atp-kpi-value">{value}</div>
    {hint && <div className="atp-kpi-hint">{hint}</div>}
  </>;
  const cls = `atp-kpi atp-kpi-${tone}`;
  return onClick ? <button type="button" onClick={onClick} className={cls}>{content}</button> : <div className={cls}>{content}</div>;
}

function MiniStat({ icon, label, value, warning, danger }: { icon: ReactNode; label: string; value: number; warning?: boolean; danger?: boolean }) {
  const cls = danger ? "border-red-100 bg-red-50 text-red-700" : warning ? "border-amber-100 bg-amber-50 text-amber-700" : "border-slate-100 bg-slate-50 text-slate-600";
  return <div className={`flex items-center gap-2 rounded-xl border p-2.5 ${cls}`}><span>{icon}</span><div><div className="text-[10px] font-semibold opacity-70">{label}</div><div className="text-sm font-[750]">{value}</div></div></div>;
}

function LegendDot({ color, label, value, icon }: { color: string; label: string; value: string; icon: ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{icon}<span>{label}</span></div><b className="font-[700] text-slate-900">{value}</b></div>;
}

function StockRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "#16a34a" : tone === "warn" ? "#d97706" : "#dc2626";
  const pct = Math.min(100, Math.max(0, (value / total) * 100));
  return <div><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-slate-500">{label}</span><b className="text-slate-800">{value}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div></div>;
}

function SalesLineChart({ data }: { data: Array<{ label: string; total: number }> }) {
  const width = 680;
  const height = 190;
  const padX = 28;
  const padTop = 18;
  const padBottom = 30;
  const max = Math.max(...data.map((d) => d.total), 1);
  const usableW = width - padX * 2;
  const usableH = height - padTop - padBottom;
  const points = data.map((d, i) => ({ x: padX + (usableW * i) / Math.max(data.length - 1, 1), y: padTop + usableH - (d.total / max) * usableH }));

  const path = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${d} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");
  const area = `${path} L ${points[points.length - 1].x} ${padTop + usableH} L ${points[0].x} ${padTop + usableH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Ventes des sept derniers jours">
      <defs>
        <linearGradient id="salesModernFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.18"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient>
      </defs>
      <g className="atp-chart-grid">{[0,1,2,3].map((i) => { const y = padTop + (usableH * i) / 3; return <line key={i} x1={padX} y1={y} x2={width-padX} y2={y}/>; })}</g>
      <path d={area} fill="url(#salesModernFill)" />
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.4" fill="#fff" stroke="#2563eb" strokeWidth="2" />)}
      {data.map((d, i) => <text key={d.label} x={points[i].x} y={height-7} textAnchor="middle" fontSize="10.5" fill="#94a3b8" fontWeight="650">{d.label}</text>)}
    </svg>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-sm text-slate-400">{text}</div>;
}
