import type { Repair } from "../types/repair";
import type { Sale } from "../types/sale";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] ?? char));
}

function parseDatabaseDate(value: string) {
  if (!value) return new Date();
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function openPrintWindow(title: string, content: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#fff}.sheet{max-width:760px;margin:0 auto}.head{text-align:center;border-bottom:2px solid #111;padding-bottom:14px}.head h1{font-size:24px;margin:0 0 5px}.muted{color:#666;font-size:12px}.meta{display:flex;justify-content:space-between;gap:20px;margin:18px 0;font-size:13px}.box{border:1px solid #ddd;border-radius:8px;padding:14px;margin:14px 0}.row{display:flex;justify-content:space-between;gap:20px;padding:9px 0;border-bottom:1px solid #eee}.row:last-child{border-bottom:0}.total{font-size:21px;font-weight:800;border-top:2px solid #111;margin-top:8px;padding-top:12px}.label{font-weight:700}.service{background:#fff8e8;padding:10px;border-radius:6px}.footer{text-align:center;margin-top:28px;font-size:12px;color:#555}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:50px}.signature{border-top:1px solid #555;padding-top:7px;text-align:center;font-size:12px}@media print{button{display:none}.sheet{max-width:none}}
  </style></head><body><div class="sheet">${content}</div><script>window.onload=()=>{setTimeout(()=>window.print(),150)}</script></body></html>`);
  w.document.close();
}

export function printSaleReceipt(sale: Sale) {
  const date = parseDatabaseDate(sale.created_at).toLocaleString("fr-FR");
  const productRows = (sale.items || []).map((item) => `
    <div class="row"><span>${escapeHtml(item.product_name)} × ${item.quantity}<br><span class="muted">${escapeHtml(item.barcode || "")}</span></span><span>${Number(item.total).toFixed(2)} €</span></div>
  `).join("");
  const repairRows = (sale.repair_items || []).map((item) => `
    <div class="row service"><span><b>Réparation</b><br><span class="muted">${escapeHtml(item.description)}</span></span><span>${Number(item.total).toFixed(2)} €</span></div>
  `).join("");

  openPrintWindow(sale.sale_number, `
    <div class="head"><h1>ATELIER TROTTINETTE PRO</h1><div class="muted">Reçu de vente / prestation</div></div>
    <div class="meta"><span><span class="label">N° vente :</span> ${escapeHtml(sale.sale_number)}</span><span>${escapeHtml(date)}</span></div>
    <div class="box">${productRows}${repairRows}<div class="row total"><span>TOTAL</span><span>${Number(sale.total).toFixed(2)} €</span></div><div class="row"><span>Mode de paiement</span><span>${escapeHtml(sale.payment_method)}</span></div>${sale.payment_method === "Espèces" && sale.cash_received != null ? `<div class="row"><span>Montant reçu</span><span>${Number(sale.cash_received).toFixed(2)} €</span></div><div class="row"><span>Monnaie rendue</span><span>${Number(sale.change_due || 0).toFixed(2)} €</span></div>` : ""}</div>
    <div class="footer">Merci pour votre confiance</div>
  `);
}

export function printRepairDeposit(repair: Repair) {
  const date = parseDatabaseDate(repair.created_at).toLocaleString("fr-FR");
  const client = repair.client_name?.trim() || "Client comptoir";
  const scooter = `${repair.brand || ""} ${repair.model || ""}`.trim() || "Non précisée";
  openPrintWindow(`Dépôt réparation ${repair.id}`, `
    <div class="head"><h1>ATELIER TROTTINETTE PRO</h1><div class="muted">REÇU DE DÉPÔT — RÉPARATION</div></div>
    <div class="meta"><span><span class="label">Réparation :</span> R-${String(repair.id).padStart(5,"0")}</span><span>${escapeHtml(date)}</span></div>
    <div class="box"><div class="row"><span class="label">Client</span><span>${escapeHtml(client)}</span></div>${repair.phone ? `<div class="row"><span class="label">Téléphone</span><span>${escapeHtml(repair.phone)}</span></div>` : ""}<div class="row"><span class="label">Trottinette</span><span>${escapeHtml(scooter)}</span></div></div>
    <div class="box"><div class="row"><span class="label">Problème signalé</span><span>${escapeHtml(repair.problem)}</span></div><div class="row"><span class="label">État à la réception</span><span>${escapeHtml(repair.reception_condition || "Non précisé")}</span></div><div class="row"><span class="label">Accessoires laissés</span><span>${escapeHtml(repair.accessories || "Aucun")}</span></div></div>
    <div class="signatures"><div class="signature">Signature client</div><div class="signature">Signature magasin</div></div>
  `);
}

export function printRepairDelivery(repair: Repair) {
  const date = parseDatabaseDate(repair.delivered_at || repair.created_at).toLocaleString("fr-FR");
  const client = repair.client_name?.trim() || "Client comptoir";
  const scooter = `${repair.brand || ""} ${repair.model || ""}`.trim() || "Non précisée";
  openPrintWindow(`Restitution réparation ${repair.id}`, `
    <div class="head"><h1>ATELIER TROTTINETTE PRO</h1><div class="muted">REÇU DE RESTITUTION — RÉPARATION</div></div>
    <div class="meta"><span><span class="label">Réparation :</span> R-${String(repair.id).padStart(5,"0")}</span><span>${escapeHtml(date)}</span></div>
    <div class="box"><div class="row"><span class="label">Client</span><span>${escapeHtml(client)}</span></div><div class="row"><span class="label">Trottinette</span><span>${escapeHtml(scooter)}</span></div><div class="row"><span class="label">Problème signalé</span><span>${escapeHtml(repair.problem)}</span></div><div class="row total"><span>MONTANT RÉPARATION</span><span>${Number(repair.total || 0).toFixed(2)} €</span></div></div>
    <div class="footer">Merci de votre confiance</div>
  `);
}
