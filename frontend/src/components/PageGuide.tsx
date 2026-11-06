import { CircleHelp, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PageName } from "./TopNav";

const GUIDES: Partial<Record<PageName, { title: string; text: string }>> = {
  sale: { title: "Flux vente", text: "Scanner / choisir → panier → paiement → valider." },
  products: { title: "Catalogue", text: "Recherchez par nom, marque, référence ou code-barres. Les quantités se gèrent dans Stock." },
  stock: { title: "Stock", text: "Scanner pour identifier. Utilisez + Stock uniquement lors d’une réception de marchandise." },
  history: { title: "Historique", text: "Consultez, réimprimez, corrigez ou remboursez une vente sans supprimer sa trace." },
  reports: { title: "Rapports", text: "Changez la période pour analyser ventes, paiements, produits, atelier et stock." },
  repairs: { title: "Flux atelier", text: "Réception → En cours → Prête → Caisse → Restituée." },
  backup: { title: "Sauvegarde", text: "Automatique au démarrage puis toutes les 6 h. Créez une copie manuelle avant une restauration." },
};

export default function PageGuide({ page }: { page: PageName }) {
  const guide = GUIDES[page];
  const storageKey = `atp-guide-hidden-${page}`;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(localStorage.getItem(storageKey) !== "1");
  }, [storageKey]);

  if (!guide || !visible) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  return (
    <div className="mb-3 flex justify-end">
      <div className="atp-guide">
        <span className="atp-guide-icon"><CircleHelp size={15} /></span>
        <div className="min-w-0">
          <span className="atp-guide-title">{guide.title}</span>
          <span className="atp-guide-text">{guide.text}</span>
        </div>
        <button type="button" onClick={dismiss} className="atp-guide-close" aria-label="Masquer l’aide">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
