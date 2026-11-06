import { Router } from "express";
import { db } from "../database/db.js";

const router = Router();

router.get("/", (_req, res) => {
  const products = db.prepare(`
    SELECT *
    FROM products
    ORDER BY name ASC
  `).all();
  res.json(products);
});

router.get("/barcode/:barcode", (req, res) => {
  const product = db.prepare(`
    SELECT * FROM products WHERE barcode = ?
  `).get(req.params.barcode);

  if (!product) return res.status(404).json({ message: "Produit introuvable" });
  res.json(product);
});

router.post("/", (req, res) => {
  const {
    name,
    barcode,
    category = "",
    productType = "Pièce détachée",
    brand = "",
    model = "",
    reference = "",
    compatibleModels = "",
    buyPrice = 0,
    sellPrice = 0,
    quantity = 0,
    minimumStock = 0,
  } = req.body;

  if (!name?.trim() || !barcode?.trim()) {
    return res.status(400).json({ message: "Nom et code-barres obligatoires" });
  }

  const numericValues = [buyPrice, sellPrice, quantity, minimumStock].map(Number);
  if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
    return res.status(400).json({ message: "Vérifiez les prix et les quantités" });
  }

  try {
    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO products (
          name, barcode, category, product_type, brand, model, reference,
          compatible_models, buy_price, sell_price, quantity, minimum_stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        barcode.trim(),
        String(category || "").trim(),
        String(productType || "Pièce détachée").trim(),
        String(brand || "").trim(),
        String(model || "").trim(),
        String(reference || "").trim(),
        String(compatibleModels || "").trim(),
        Number(buyPrice),
        Number(sellPrice),
        Number(quantity),
        Number(minimumStock)
      );

      const productId = Number(result.lastInsertRowid);
      if (Number(quantity) > 0) {
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, note)
          VALUES (?, 'INITIAL', ?, 'Stock initial')
        `).run(productId, Number(quantity));
      }
      return productId;
    });

    const productId = transaction();
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    return res.status(201).json(product);
  } catch {
    return res.status(400).json({
      message: "Impossible d'enregistrer le produit. Le code-barres existe peut-être déjà.",
    });
  }
});

router.put("/:id", (req, res) => {
  const productId = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as any;
  if (!existing) return res.status(404).json({ message: "Produit introuvable" });

  const {
    name = existing.name,
    barcode = existing.barcode,
    category = existing.category || "",
    productType = existing.product_type || "Pièce détachée",
    brand = existing.brand || "",
    model = existing.model || "",
    reference = existing.reference || "",
    compatibleModels = existing.compatible_models || "",
    buyPrice = existing.buy_price,
    sellPrice = existing.sell_price,
    minimumStock = existing.minimum_stock,
  } = req.body;

  if (!String(name).trim() || !String(barcode).trim()) {
    return res.status(400).json({ message: "Nom et code-barres obligatoires" });
  }

  if ([buyPrice, sellPrice, minimumStock].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return res.status(400).json({ message: "Vérifiez les prix et le stock minimum" });
  }

  try {
    db.prepare(`
      UPDATE products
      SET name = ?, barcode = ?, category = ?, product_type = ?, brand = ?, model = ?,
          reference = ?, compatible_models = ?, buy_price = ?, sell_price = ?,
          minimum_stock = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      String(name).trim(),
      String(barcode).trim(),
      String(category || "").trim(),
      String(productType || "Pièce détachée").trim(),
      String(brand || "").trim(),
      String(model || "").trim(),
      String(reference || "").trim(),
      String(compatibleModels || "").trim(),
      Number(buyPrice),
      Number(sellPrice),
      Number(minimumStock),
      productId
    );

    return res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(productId));
  } catch {
    return res.status(400).json({ message: "Impossible de mettre à jour le produit. Vérifiez le code-barres." });
  }
});

router.post("/:id/stock", (req, res) => {
  const productId = Number(req.params.id);
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "La quantité doit être supérieure à 0" });
  }

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!product) return res.status(404).json({ message: "Produit introuvable" });

  db.transaction(() => {
    db.prepare(`
      UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(quantity, productId);
    db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, note)
      VALUES (?, 'IN', ?, 'Réception de stock')
    `).run(productId, quantity);
  })();

  return res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(productId));
});

export default router;
