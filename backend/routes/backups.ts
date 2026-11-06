import path from "node:path";
import { Router } from "express";
import {
  backupsDir,
  createDatabaseBackup,
  listDatabaseBackups,
} from "../services/backup.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(listDatabaseBackups());
});

router.post("/", async (_req, res) => {
  try {
    const result = await createDatabaseBackup("manual");
    res.status(201).json({
      message: "Sauvegarde créée",
      filename: result.filename,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Impossible de créer la sauvegarde" });
  }
});

router.get("/:filename/download", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith(".db")) {
    return res.status(400).json({ message: "Fichier invalide" });
  }

  const filePath = path.join(backupsDir, filename);
  res.download(filePath, filename, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ message: "Sauvegarde introuvable" });
    }
  });
});

export default router;
