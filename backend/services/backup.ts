import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../database/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backupsDir = path.resolve(__dirname, "../../backups");
fs.mkdirSync(backupsDir, { recursive: true });

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export async function createDatabaseBackup(prefix = "auto") {
  const filename = `${prefix}_${stamp()}.db`;
  const destination = path.join(backupsDir, filename);
  await db.backup(destination);
  cleanupOldBackups(20);
  return { filename, path: destination };
}

export function listDatabaseBackups() {
  return fs.readdirSync(backupsDir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => {
      const fullPath = path.join(backupsDir, name);
      const stat = fs.statSync(fullPath);
      return {
        filename: name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function cleanupOldBackups(keep: number) {
  const files = listDatabaseBackups();
  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(backupsDir, file.filename));
    } catch {
      // Keep running even if one old file cannot be removed.
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startAutomaticBackups() {
  // One safe SQLite backup each time the POS starts.
  createDatabaseBackup("startup").catch((error) => {
    console.error("Automatic startup backup failed:", error);
  });

  // And another one every 6 hours while the POS remains open.
  if (!timer) {
    timer = setInterval(() => {
      createDatabaseBackup("auto").catch((error) => {
        console.error("Automatic backup failed:", error);
      });
    }, 6 * 60 * 60 * 1000);
  }
}
