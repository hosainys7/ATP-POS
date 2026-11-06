import { Router } from "express";
import { db } from "../database/db.js";

const router = Router();

type SaleItemInput = { productId: number; quantity: number };
type RepairItemInput = { repairId: number };
type ReturnItemInput = { saleItemId: number; quantity: number };

function saleSummaryQuery() {
  return `
    SELECT s.*,
      COALESCE((SELECT SUM(sr.total) FROM sale_returns sr WHERE sr.sale_id = s.id), 0) AS returned_total,
      CASE WHEN s.status = 'Annulée' THEN 0
           ELSE s.total - COALESCE((SELECT SUM(sr.total) FROM sale_returns sr WHERE sr.sale_id = s.id), 0)
      END AS net_total
    FROM sales s
  `;
}

router.get("/", (_req, res) => {
  const sales = db.prepare(`${saleSummaryQuery()} ORDER BY s.id DESC`).all();
  res.json(sales);
});

router.get("/:id", (req, res) => {
  const saleId = Number(req.params.id);
  const sale = db.prepare(`${saleSummaryQuery()} WHERE s.id = ?`).get(saleId);
  if (!sale) return res.status(404).json({ message: "Vente introuvable" });

  const items = db.prepare(`
    SELECT si.*,
      COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) AS returned_quantity
    FROM sale_items si
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
  `).all(saleId);

  const repairItems = db.prepare(`
    SELECT sri.id, sri.repair_id, sri.description, sri.unit_price, sri.total,
           r.client_name, r.brand, r.model
    FROM sale_repair_items sri
    JOIN repairs r ON r.id = sri.repair_id
    WHERE sri.sale_id = ?
    ORDER BY sri.id ASC
  `).all(saleId);

  const returns = db.prepare(`
    SELECT * FROM sale_returns WHERE sale_id = ? ORDER BY id DESC
  `).all(saleId).map((entry: any) => ({
    ...entry,
    items: db.prepare(`SELECT * FROM sale_return_items WHERE return_id = ? ORDER BY id`).all(entry.id),
  }));

  res.json({ ...sale, items, repair_items: repairItems, returns });
});

router.post("/", (req, res) => {
  const items = (req.body.items ?? []) as SaleItemInput[];
  const repairs = (req.body.repairs ?? []) as RepairItemInput[];
  const paymentMethod = String(req.body.paymentMethod ?? "").trim();
  const cashReceivedRaw = req.body.cashReceived;

  if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(repairs) || repairs.length === 0)) {
    return res.status(400).json({ message: "Ajoutez au moins un produit ou une réparation" });
  }
  if (!["Espèces", "Carte"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Mode de paiement invalide" });
  }

  try {
    const result = db.transaction(() => {
      const preparedProducts = items.map((item) => {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantité invalide");

        const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(Number(item.productId)) as any;
        if (!product) throw new Error("Produit introuvable");
        if (Number(product.quantity) < quantity) throw new Error(`Stock insuffisant : ${product.name}`);

        const unitPrice = Number(product.sell_price);
        return { product, quantity, unitPrice, lineTotal: unitPrice * quantity };
      });

      const preparedRepairs = repairs.map((item) => {
        const repair = db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(Number(item.repairId)) as any;
        if (!repair) throw new Error("Réparation introuvable");
        if (repair.status !== "Prête") throw new Error(`La réparation R-${String(repair.id).padStart(5, "0")} n'est pas prête`);
        if (repair.sale_id) throw new Error(`La réparation R-${String(repair.id).padStart(5, "0")} a déjà été encaissée`);
        if (Number(repair.total) <= 0) throw new Error(`Montant manquant pour la réparation R-${String(repair.id).padStart(5, "0")}`);

        const description = `Réparation R-${String(repair.id).padStart(5, "0")} · ${repair.client_name} · ${[repair.brand, repair.model].filter(Boolean).join(" ")}`;
        return { repair, description, lineTotal: Number(repair.total) };
      });

      const productTotal = preparedProducts.reduce((sum, item) => sum + item.lineTotal, 0);
      const repairTotal = preparedRepairs.reduce((sum, item) => sum + item.lineTotal, 0);
      const total = productTotal + repairTotal;

      let cashReceived: number | null = null;
      let changeDue = 0;
      if (paymentMethod === "Espèces") {
        cashReceived = cashReceivedRaw === "" || cashReceivedRaw == null ? total : Number(cashReceivedRaw);
        if (!Number.isFinite(cashReceived) || cashReceived < total) {
          throw new Error("Le montant reçu doit être au moins égal au total");
        }
        changeDue = cashReceived - total;
      }

      const tempNumber = `V-${Date.now()}`;
      const saleInsert = db.prepare(`
        INSERT INTO sales (sale_number, payment_method, subtotal, total, paid, status, cash_received, change_due)
        VALUES (?, ?, ?, ?, ?, 'Validée', ?, ?)
      `).run(tempNumber, paymentMethod, total, total, total, cashReceived, changeDue);

      const saleId = Number(saleInsert.lastInsertRowid);
      const saleNumber = `V-${String(saleId).padStart(6, "0")}`;
      db.prepare(`UPDATE sales SET sale_number = ? WHERE id = ?`).run(saleNumber, saleId);

      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare(`
        UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);
      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, 'SALE', ?, ?)
      `);

      for (const item of preparedProducts) {
        insertItem.run(saleId, item.product.id, item.product.name, item.product.barcode, item.quantity, item.unitPrice, item.lineTotal);
        updateStock.run(item.quantity, item.product.id);
        insertMovement.run(item.product.id, -item.quantity, saleNumber);
      }

      const insertRepairItem = db.prepare(`
        INSERT INTO sale_repair_items (sale_id, repair_id, description, unit_price, total)
        VALUES (?, ?, ?, ?, ?)
      `);
      const closeRepair = db.prepare(`
        UPDATE repairs
        SET status = 'Restituée', payment_method = ?, delivered_at = CURRENT_TIMESTAMP, sale_id = ?
        WHERE id = ?
      `);

      for (const item of preparedRepairs) {
        insertRepairItem.run(saleId, item.repair.id, item.description, item.lineTotal, item.lineTotal);
        closeRepair.run(paymentMethod, saleId, item.repair.id);
      }

      return { saleId };
    })();

    const sale = db.prepare(`${saleSummaryQuery()} WHERE s.id = ?`).get(result.saleId);
    const saleItems = db.prepare(`SELECT *, 0 AS returned_quantity FROM sale_items WHERE sale_id = ? ORDER BY id`).all(result.saleId);
    const repairItems = db.prepare(`
      SELECT sri.id, sri.repair_id, sri.description, sri.unit_price, sri.total,
             r.client_name, r.brand, r.model
      FROM sale_repair_items sri
      JOIN repairs r ON r.id = sri.repair_id
      WHERE sri.sale_id = ? ORDER BY sri.id
    `).all(result.saleId);

    res.status(201).json({ ...sale, items: saleItems, repair_items: repairItems, returns: [] });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Impossible d'enregistrer la vente" });
  }
});

// Safe correction of a cashier mistake: keeps the original sale and marks it cancelled.
router.post("/:id/cancel", (req, res) => {
  const saleId = Number(req.params.id);
  const reason = String(req.body.reason ?? "Erreur de caisse").trim();

  try {
    db.transaction(() => {
      const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId) as any;
      if (!sale) throw new Error("Vente introuvable");
      if (sale.status === "Annulée") throw new Error("Cette vente est déjà annulée");

      const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(saleId) as any[];
      for (const item of items) {
        const alreadyReturned = Number((db.prepare(`
          SELECT COALESCE(SUM(quantity), 0) AS qty FROM sale_return_items WHERE sale_item_id = ?
        `).get(item.id) as any).qty || 0);
        const quantityToRestore = Math.max(0, Number(item.quantity) - alreadyReturned);
        if (quantityToRestore > 0) {
          db.prepare(`UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(quantityToRestore, item.product_id);
          db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, 'CANCEL', ?, ?)`)
            .run(item.product_id, quantityToRestore, sale.sale_number);
        }
      }

      const repairItems = db.prepare(`SELECT repair_id FROM sale_repair_items WHERE sale_id = ?`).all(saleId) as any[];
      for (const item of repairItems) {
        db.prepare(`
          UPDATE repairs
          SET status = 'Prête', payment_method = NULL, delivered_at = NULL, sale_id = NULL
          WHERE id = ?
        `).run(item.repair_id);
      }

      db.prepare(`
        UPDATE sales SET status = 'Annulée', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = ? WHERE id = ?
      `).run(reason || "Erreur de caisse", saleId);
    })();

    res.json({ message: "Vente annulée et stock restauré" });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Impossible d'annuler la vente" });
  }
});

// Product return / refund. The original sale remains visible and traceable.
router.post("/:id/returns", (req, res) => {
  const saleId = Number(req.params.id);
  const items = (req.body.items ?? []) as ReturnItemInput[];
  const paymentMethod = String(req.body.paymentMethod ?? "").trim();
  const reason = String(req.body.reason ?? "Retour client").trim();

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Sélectionnez au moins un article à retourner" });
  }
  if (!["Espèces", "Carte"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Mode de remboursement invalide" });
  }

  try {
    const result = db.transaction(() => {
      const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId) as any;
      if (!sale) throw new Error("Vente introuvable");
      if (sale.status === "Annulée") throw new Error("Une vente annulée ne peut pas être remboursée");

      const prepared = items.map((input) => {
        const saleItem = db.prepare(`SELECT * FROM sale_items WHERE id = ? AND sale_id = ?`).get(Number(input.saleItemId), saleId) as any;
        if (!saleItem) throw new Error("Article de vente introuvable");
        const quantity = Number(input.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantité de retour invalide");
        const alreadyReturned = Number((db.prepare(`SELECT COALESCE(SUM(quantity), 0) AS qty FROM sale_return_items WHERE sale_item_id = ?`).get(saleItem.id) as any).qty || 0);
        const remaining = Number(saleItem.quantity) - alreadyReturned;
        if (quantity > remaining) throw new Error(`Quantité de retour trop élevée pour ${saleItem.product_name}`);
        return { saleItem, quantity, total: quantity * Number(saleItem.unit_price) };
      });

      const total = prepared.reduce((sum, entry) => sum + entry.total, 0);
      const tempNumber = `RET-${Date.now()}`;
      const insert = db.prepare(`
        INSERT INTO sale_returns (sale_id, return_number, payment_method, total, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(saleId, tempNumber, paymentMethod, total, reason);
      const returnId = Number(insert.lastInsertRowid);
      const returnNumber = `RET-${String(returnId).padStart(6, "0")}`;
      db.prepare(`UPDATE sale_returns SET return_number = ? WHERE id = ?`).run(returnNumber, returnId);

      const insertItem = db.prepare(`
        INSERT INTO sale_return_items (return_id, sale_item_id, product_id, product_name, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of prepared) {
        insertItem.run(returnId, entry.saleItem.id, entry.saleItem.product_id, entry.saleItem.product_name, entry.quantity, entry.saleItem.unit_price, entry.total);
        db.prepare(`UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(entry.quantity, entry.saleItem.product_id);
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, 'RETURN', ?, ?)`)
          .run(entry.saleItem.product_id, entry.quantity, returnNumber);
      }
      return { returnId };
    })();

    const entry = db.prepare(`SELECT * FROM sale_returns WHERE id = ?`).get(result.returnId);
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Impossible d'enregistrer le retour" });
  }
});

export default router;
