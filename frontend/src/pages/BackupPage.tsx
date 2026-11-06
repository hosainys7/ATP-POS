import { DatabaseBackup, Download, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createBackup, getBackups, backupDownloadUrl, type BackupFile } from "../services/api";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setBackups(await getBackups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les sauvegardes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function makeBackup() {
    setCreating(true);
    setMessage("");
    setError("");
    try {
      await createBackup();
      setMessage("Sauvegarde créée avec succès.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la sauvegarde");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="atp-kicker text-xs">Protection des données</p>
          <h1 className="mt-0.5 text-slate-950">Sauvegarde</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Le système crée automatiquement une copie de la base au démarrage puis toutes les 6 heures.
          </p>
        </div>
        <button
          onClick={makeBackup}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
        >
          <DatabaseBackup size={18} />
          {creating ? "Création..." : "Créer une sauvegarde"}
        </button>
      </div>

      <div className="atp-stat-strip grid-cols-3">
        <BackupStat icon={<ShieldCheck size={16} />} label="Protection automatique" value="Active" tone="orange" />
        <BackupStat icon={<HardDrive size={16} />} label="Copies conservées" value={String(backups.length)} />
        <BackupStat icon={<RefreshCw size={16} />} label="Fréquence" value="Démarrage + 6 h" />
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="atp-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-bold text-slate-900">Copies disponibles</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">Les 20 sauvegardes les plus récentes sont conservées.</p>
          </div>
          <button onClick={load} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Actualiser
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-slate-400">Chargement...</div>
        ) : backups.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400">Aucune sauvegarde disponible.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <div key={backup.filename} className="grid grid-cols-[1fr_110px_110px] items-center gap-3 px-4 py-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-900">{backup.filename}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {new Date(backup.createdAt).toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{formatBytes(backup.size)}</div>
                <a
                  href={backupDownloadUrl(backup.filename)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download size={15} /> Télécharger
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        <b>Restauration :</b> utilisez <b>RESTORE_BACKUP.bat</b> lorsque le POS est fermé. Le lanceur sauvegarde d'abord la base actuelle puis restaure la copie choisie en sécurité.
      </div>
    </div>
  );
}

function BackupStat({ icon, label, value, tone = "slate" }: { icon: React.ReactNode; label: string; value: string; tone?: "orange" | "slate" }) {
  return <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-sm font-black text-slate-900">{value}</div></div><span className={tone === "orange" ? "text-orange-600" : "text-slate-500"}>{icon}</span></div>;
}
