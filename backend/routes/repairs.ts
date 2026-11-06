import { Router } from "express";
import { db } from "../database/db.js";

const router = Router();

router.get("/", (_req, res) => {
  const repairs = db.prepare(`SELECT * FROM repairs ORDER BY id DESC`).all();
  res.json(repairs);
});

router.get("/ready-for-sale", (_req, res) => {
  const repairs = db.prepare(`
    SELECT * FROM repairs
    WHERE status = 'Prête' AND COALESCE(sale_id, 0) = 0 AND total > 0
    ORDER BY id DESC
  `).all();
  res.json(repairs);
});

router.post("/", (req, res) => {
  const {
    clientName = "", phone = "", brand = "", model = "", problem,
    receptionCondition = "", accessories = "",
    serviceCategory = "", serviceName = "", servicePriceHint = ""
  } = req.body;

  if (!String(problem || "").trim()) {
    return res.status(400).json({ message: "Le problème signalé est obligatoire" });
  }

  const result = db.prepare(`
    INSERT INTO repairs (
      client_name, phone, brand, model, serial_number, problem,
      reception_condition, accessories, service_category, service_name, service_price_hint, status
    ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'Reçue')
  `).run(
    String(clientName).trim(), String(phone).trim(), String(brand).trim(), String(model).trim(),
    String(problem).trim(), String(receptionCondition).trim(), String(accessories).trim(),
    String(serviceCategory).trim(), String(serviceName).trim(), String(servicePriceHint).trim()
  );

  const repair = db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(repair);
});

// Fast counter repair: creates a real repair record already prepared for checkout.
router.post("/quick", (req, res) => {
  const {
    clientName = "", phone = "", brand = "", model = "",
    problem = "Réparation rapide", repairDetails = "", partsCost = 0, laborCost = 0,
    serviceCategory = "Réparation rapide", serviceName = "Petite intervention rapide", servicePriceHint = "",
  } = req.body;

  const parts = Math.max(0, Number(partsCost) || 0);
  const labor = Math.max(0, Number(laborCost) || 0);
  const total = parts + labor;
  if (total <= 0) return res.status(400).json({ message: "Saisissez le montant de la réparation" });

  const result = db.prepare(`
    INSERT INTO repairs (
      client_name, phone, brand, model, serial_number, problem, diagnosis, repair_details,
      parts_cost, labor_cost, total, service_category, service_name, service_price_hint, status
    ) VALUES (?, ?, ?, ?, '', ?, '', ?, ?, ?, ?, ?, ?, ?, 'Prête')
  `).run(
    String(clientName).trim(), String(phone).trim(), String(brand).trim(), String(model).trim(),
    String(problem).trim(), String(repairDetails).trim(), parts, labor, total,
    String(serviceCategory).trim(), String(serviceName).trim(), String(servicePriceHint).trim()
  );

  res.status(201).json(db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(result.lastInsertRowid));
});

router.patch("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "").trim();
  if (!["Reçue", "En cours", "Prête", "Restituée"].includes(status)) {
    return res.status(400).json({ message: "Statut invalide" });
  }

  const current = db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(id) as any;
  if (!current) return res.status(404).json({ message: "Réparation introuvable" });
  if (status === "Restituée" && !current.sale_id) {
    return res.status(400).json({ message: "La restitution se fait depuis Nouvelle vente après encaissement" });
  }

  db.prepare(`UPDATE repairs SET status = ? WHERE id = ?`).run(status, id);
  res.json(db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(id));
});

// Kept for compatibility with the frontend. Only the amount is required now.
router.post("/:id/prepare", (req, res) => {
  const id = Number(req.params.id);
  const { partsCost = 0, laborCost = 0 } = req.body;

  const repair = db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(id) as any;
  if (!repair) return res.status(404).json({ message: "Réparation introuvable" });
  if (repair.status === "Restituée" || repair.sale_id) {
    return res.status(400).json({ message: "Cette réparation a déjà été encaissée" });
  }

  const total = Math.max(0, Number(partsCost) || 0) + Math.max(0, Number(laborCost) || 0);
  if (total <= 0) return res.status(400).json({ message: "Saisissez le montant final de la réparation" });

  db.prepare(`
    UPDATE repairs SET
      diagnosis = '', repair_details = '', parts_cost = 0, labor_cost = ?, total = ?, status = 'Prête'
    WHERE id = ?
  `).run(total, total, id);

  res.json(db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(id));
});

router.post("/:id/deliver", (req, res) => {
  const id = Number(req.params.id);
  const repair = db.prepare(`SELECT * FROM repairs WHERE id = ?`).get(id) as any;
  if (!repair) return res.status(404).json({ message: "Réparation introuvable" });
  return res.status(400).json({ message: "Encaissez la réparation dans Nouvelle vente." });
});

export default router;
