import {
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PageName } from "../components/TopNav";
import { getProducts, getRepairs, getSaleById, getSales } from "../services/api";
import type { Product } from "../types/product";
import type { Repair } from "../types/repair";
import type { Sale, SaleSummary } from "../types/sale";

export type ReportPeriod = "today" | "7d" | "month" | "30d" | "all";

type Props = { preset: ReportPeriod; onNavigate: (page: PageName) => void };

function parseDatabaseDate(value: string) {
  if (!value) return new Date(NaN);
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}
function euro(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0); }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function netSale(sale: SaleSummary) { if (sale.status === "Annulée") return 0; return Number(sale.net_total ?? (Number(sale.total || 0) - Number(sale.returned_total || 0))); }
function inPeriod(date: Date, period: ReportPeriod) {
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  if (period === "all") return true;
  if (period === "today") return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate();
  if (period === "month") return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth();
  const days = period === "7d" ? 7 : 30;
  const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate()-(days-1));
  return date >= start && date <= now;
}

export default function ReportsPage({ preset, onNavigate }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>(preset);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [details, setDetails] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setPeriod(preset); }, [preset]);
  useEffect(() => {
    (async () => {
      try {
        const [s,p,r] = await Promise.all([getSales(), getProducts(), getRepairs()]);
        setSales(s); setProducts(p); setRepairs(r); setError("");
      } catch (e) { setError(e instanceof Error ? e.message : "Impossible de charger les rapports"); }
      finally { setLoading(false); }
    })();
  }, []);

  const periodSales = useMemo(() => sales.filter(s => inPeriod(parseDatabaseDate(s.created_at), period)), [sales, period]);
  const validSales = useMemo(() => periodSales.filter(s => s.status !== "Annulée"), [periodSales]);

  useEffect(() => {
    let cancelled=false;
    (async () => {
      try {
        const rows = await Promise.all(validSales.map(s => getSaleById(s.id)));
        if (!cancelled) setDetails(rows);
      } catch { if (!cancelled) setDetails([]); }
    })();
    return () => { cancelled=true; };
  }, [validSales]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const metrics = useMemo(() => {
    const revenue = validSales.reduce((sum,s)=>sum+netSale(s),0);
    const cash = validSales.filter(s=>s.payment_method==="Espèces").reduce((sum,s)=>sum+netSale(s),0);
    const card = validSales.filter(s=>s.payment_method==="Carte").reduce((sum,s)=>sum+netSale(s),0);
    const returns = validSales.reduce((sum,s)=>sum+Number(s.returned_total||0),0);
    const cancelled = periodSales.filter(s=>s.status==="Annulée").length;
    const productRevenue = details.flatMap(s=>s.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)-Number(item.returned_quantity||0))*Number(item.unit_price||0),0);
    const repairRevenue = details.flatMap(s=>s.repair_items||[]).reduce((sum,item)=>sum+Number(item.total||0),0);
    const units = details.flatMap(s=>s.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)-Number(item.returned_quantity||0)),0);
    return { revenue, cash, card, returns, cancelled, productRevenue, repairRevenue, units, transactions: validSales.length, average: validSales.length ? revenue/validSales.length : 0 };
  }, [validSales, periodSales, details]);

  const topProducts = useMemo(() => {
    const map = new Map<string,{name:string; qty:number; revenue:number}>();
    for (const sale of details) for (const item of sale.items||[]) {
      const qty=Math.max(0,Number(item.quantity)-Number(item.returned_quantity||0));
      const cur=map.get(item.product_name)||{name:item.product_name,qty:0,revenue:0}; cur.qty+=qty; cur.revenue+=qty*Number(item.unit_price||0); map.set(item.product_name,cur);
    }
    return [...map.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  }, [details]);

  const categoryRows = useMemo(() => {
    const map = new Map<string,{name:string; qty:number; revenue:number}>();
    for (const sale of details) for (const item of sale.items||[]) {
      const product=productMap.get(item.product_id); const name=product?.category||"Sans catégorie";
      const qty=Math.max(0,Number(item.quantity)-Number(item.returned_quantity||0));
      const cur=map.get(name)||{name,qty:0,revenue:0}; cur.qty+=qty; cur.revenue+=qty*Number(item.unit_price||0); map.set(name,cur);
    }
    return [...map.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  }, [details, productMap]);

  const trend = useMemo(() => {
    const now=new Date();
    if (period==="today") {
      return Array.from({length:13},(_,i)=>{ const hour=8+i; const total=validSales.filter(s=>{const d=parseDatabaseDate(s.created_at);return d.getHours()===hour;}).reduce((sum,s)=>sum+netSale(s),0); return {label:`${hour}h`,total}; });
    }
    const days = period==="7d" ? 7 : period==="month" ? now.getDate() : period==="30d" ? 30 : 30;
    return Array.from({length:days},(_,i)=>{ const d=new Date(now); d.setHours(0,0,0,0); d.setDate(now.getDate()-(days-1-i)); const total=validSales.filter(s=>dayKey(parseDatabaseDate(s.created_at))===dayKey(d)).reduce((sum,s)=>sum+netSale(s),0); return {label:d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}),total}; });
  }, [validSales, period]);

  const repairState = useMemo(() => ({
    received: repairs.filter(r=>r.status==="Reçue").length,
    progress: repairs.filter(r=>r.status==="En cours").length,
    ready: repairs.filter(r=>r.status==="Prête").length,
    delivered: repairs.filter(r=>r.status==="Restituée").length,
  }), [repairs]);
  const low=products.filter(p=>p.quantity>0 && p.quantity<=p.minimum_stock).length;
  const out=products.filter(p=>p.quantity<=0).length;
  const payTotal=metrics.cash+metrics.card; const cashPct=payTotal?Math.round(metrics.cash/payTotal*100):0;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="atp-kicker text-xs">Analyse détaillée</p><h1 className="mt-0.5 text-slate-950">Rapports</h1><p className="mt-0.5 text-xs text-slate-500">Ventes, paiements, produits, stock et atelier.</p></div>
      <div className="flex flex-wrap gap-2">
        {([['today',"Aujourd'hui"],['7d','7 jours'],['month','Ce mois'],['30d','30 jours'],['all','Tout']] as Array<[ReportPeriod,string]>).map(([id,label])=><button key={id} onClick={()=>setPeriod(id)} className={`rounded-xl px-3.5 py-2 text-xs font-black ${period===id?'bg-slate-900 text-white':'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
      </div>
    </div>
    {error&&<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6">
      <Kpi icon={<BarChart3 size={18}/>} label="CA net" value={euro(metrics.revenue)} tone="green"/>
      <Kpi icon={<ShoppingCart size={18}/>} label="Transactions" value={String(metrics.transactions)} tone="blue" onClick={()=>onNavigate("history")}/>
      <Kpi icon={<ReceiptText size={18}/>} label="Panier moyen" value={euro(metrics.average)} tone="blue"/>
      <Kpi icon={<PackageCheck size={18}/>} label="Articles vendus" value={String(metrics.units)} tone="green"/>
      <Kpi icon={<Wrench size={18}/>} label="CA réparations" value={euro(metrics.repairRevenue)} tone="orange" onClick={()=>onNavigate("repairs")}/>
      <Kpi icon={<RotateCcw size={18}/>} label="Retours" value={euro(metrics.returns)} tone="red"/>
    </div>
    <div className="grid grid-cols-[1.6fr_0.7fr] gap-3 atp-responsive-grid">
      <section className="atp-card p-4"><div className="flex items-start justify-between"><div><h2 className="text-sm font-black">Évolution des ventes</h2><p className="mt-1 text-xs text-slate-400">Chiffre d'affaires net sur la période.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">{euro(metrics.revenue)}</span></div><div className="mt-2 h-[165px]"><LineChart data={trend}/></div></section>
      <section className="atp-card p-4"><h2 className="text-sm font-black">Modes de paiement</h2><p className="mt-1 text-xs text-slate-400">Répartition nette.</p><div className="mt-3 flex justify-center"><div className="flex h-28 w-28 items-center justify-center rounded-full" style={{background:`conic-gradient(#16a34a 0 ${cashPct}%, #2563eb ${cashPct}% 100%)`}}><div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-center"><div><div className="text-lg font-black">{euro(payTotal)}</div><div className="text-[10px] font-bold text-slate-400">ENCAISSÉ</div></div></div></div></div><div className="mt-3 space-y-2"><PayRow color="bg-emerald-500" icon={<Banknote size={15}/>} label="Espèces" value={metrics.cash}/><PayRow color="bg-blue-600" icon={<CreditCard size={15}/>} label="Carte" value={metrics.card}/></div></section>
    </div>
    <div className="grid grid-cols-2 gap-3 atp-responsive-grid">
      <Table title="Produits les plus vendus" headers={["Produit","Qté","CA"]} rows={topProducts.map(r=>[r.name,String(r.qty),euro(r.revenue)])}/>
      <Table title="Ventes par catégorie" headers={["Catégorie","Qté","CA"]} rows={categoryRows.map(r=>[r.name,String(r.qty),euro(r.revenue)])}/>
    </div>
    <div className="grid grid-cols-3 gap-3 atp-responsive-grid">
      <section className="atp-card p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black">Atelier</h2><p className="mt-1 text-xs text-slate-400">État actuel des réparations.</p></div><button onClick={()=>onNavigate("repairs")} className="text-xs font-black text-blue-600">Ouvrir →</button></div><div className="mt-4 grid grid-cols-2 gap-2"><Small label="Reçues" value={repairState.received}/><Small label="En cours" value={repairState.progress}/><Small label="Prêtes" value={repairState.ready}/><Small label="Restituées" value={repairState.delivered}/></div></section>
      <section className="atp-card p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black">Stock</h2><p className="mt-1 text-xs text-slate-400">Situation actuelle.</p></div><button onClick={()=>onNavigate("stock")} className="text-xs font-black text-blue-600">Ouvrir →</button></div><div className="mt-4 grid grid-cols-2 gap-2"><Small label="Références" value={products.length}/><Small label="Unités" value={products.reduce((a,p)=>a+p.quantity,0)}/><Small label="Faible" value={low}/><Small label="Rupture" value={out}/></div></section>
      <section className="atp-card p-4"><h2 className="text-sm font-black">Corrections</h2><p className="mt-1 text-xs text-slate-400">Contrôle de caisse.</p><div className="mt-4 space-y-3"><InfoRow label="Ventes annulées" value={String(metrics.cancelled)}/><InfoRow label="Montant retourné" value={euro(metrics.returns)}/><InfoRow label="CA produits" value={euro(metrics.productRevenue)}/><InfoRow label="CA réparations" value={euro(metrics.repairRevenue)}/></div></section>
    </div>
    {loading&&<div className="text-center text-sm text-slate-400">Chargement des rapports...</div>}
  </div>;
}

function Kpi({icon,label,value,tone,onClick}:{icon:ReactNode;label:string;value:string;tone:"green"|"blue"|"red"|"orange";onClick?:()=>void}) {
  const iconTone = {
    green:"bg-emerald-50 text-emerald-600",
    blue:"bg-blue-50 text-blue-600",
    red:"bg-red-50 text-red-600",
    orange:"bg-orange-50 text-orange-600",
  }[tone];
  const body=<><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span></div><div className="mt-2 text-lg font-black text-slate-950">{value}</div></>;
  return onClick
    ? <button onClick={onClick} className="atp-card p-3 text-left transition hover:border-slate-300 hover:shadow-sm">{body}</button>
    : <div className="atp-card p-3">{body}</div>;
}
function PayRow({color,icon,label,value}:{color:string;icon:ReactNode;label:string;value:number}) { return <div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${color}`}/>{icon}{label}</div><b>{euro(value)}</b></div>; }
function Table({title,headers,rows}:{title:string;headers:string[];rows:string[][]}) { return <section className="atp-card overflow-hidden"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-black">{title}</h2></div><div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50 text-left text-[11px] font-black uppercase text-slate-400"><tr>{headers.map(h=><th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className={`px-4 py-2.5 text-xs ${j===0?'font-bold text-slate-800':'text-slate-600'}`}>{v}</td>)}</tr>):<tr><td colSpan={headers.length} className="px-5 py-8 text-center text-sm text-slate-400">Aucune donnée sur la période.</td></tr>}</tbody></table></div></section>; }
function Small({label,value}:{label:string;value:number}) { return <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"><div className="text-[9px] font-bold uppercase text-slate-400">{label}</div><div className="mt-0.5 text-lg font-black">{value}</div></div>; }
function InfoRow({label,value}:{label:string;value:string}) { return <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><b>{value}</b></div>; }
function LineChart({data}:{data:Array<{label:string;total:number}>}) {
  const width=760,height=190,padX=34,padTop=14,padBottom=30;
  const max=Math.max(...data.map(d=>d.total),1),uw=width-padX*2,uh=height-padTop-padBottom;
  const pts=data.map((d,i)=>({x:padX+(uw*i)/Math.max(data.length-1,1),y:padTop+uh-(d.total/max)*uh}));
  const path=pts.reduce((acc,p,i)=>{
    if(i===0) return `M ${p.x} ${p.y}`;
    const prev=pts[i-1],cx=(prev.x+p.x)/2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  },"");
  const area=`${path} L ${pts[pts.length-1].x} ${padTop+uh} L ${pts[0].x} ${padTop+uh} Z`;
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
    <defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".16"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>
    {[0,1,2,3].map(i=>{const y=padTop+(uh*i)/3;return <line key={i} x1={padX} y1={y} x2={width-padX} y2={y} stroke="#edf1f5"/>})}
    <path d={area} fill="url(#reportFill)"/>
    <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#2563eb" strokeWidth="2"/>)}
    {data.map((d,i)=><text key={i} x={pts[i].x} y={height-7} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontWeight="650">{d.label}</text>)}
  </svg>;
}
