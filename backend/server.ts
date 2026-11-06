import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./database/db.js";
import productsRouter from "./routes/products.js";
import salesRouter from "./routes/sales.js";
import repairsRouter from "./routes/repairs.js";
import backupsRouter from "./routes/backups.js";
import { startAutomaticBackups } from "./services/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", system: "Atelier Trottinette Pro POS" });
});

app.use("/api/products", productsRouter);
app.use("/api/sales", salesRouter);
app.use("/api/repairs", repairsRouter);
app.use("/api/backups", backupsRouter);

startAutomaticBackups();

// Production/local-shop mode: the backend also serves the built React application.
// During development you can still use Vite on http://localhost:5173.
const frontendDist = path.resolve(__dirname, "../frontend/dist");
const frontendIndex = path.join(frontendDist, "index.html");

if (fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(frontendIndex);
  });
}

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`ATP POS running on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
