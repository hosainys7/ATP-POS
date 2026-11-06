import { useState } from "react";
import TopNav, { type PageName } from "./components/TopNav";
import PageGuide from "./components/PageGuide";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import StockPage from "./pages/StockPage";
import SalePage from "./pages/SalePage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import RepairsPage from "./pages/RepairsPage";
import ReportsPage, { type ReportPeriod } from "./pages/ReportsPage";
import BackupPage from "./pages/BackupPage";

export default function App() {
  const [page, setPage] = useState<PageName>("dashboard");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");

  function openReports(period: ReportPeriod) {
    setReportPeriod(period);
    setPage("reports");
  }

  function navigate(next: PageName) {
    if (next === "reports") setReportPeriod("month");
    setPage(next);
  }

  function renderPage() {
    switch (page) {
      case "dashboard": return <DashboardPage onNavigate={navigate} onOpenReports={openReports} />;
      case "sale": return <SalePage />;
      case "products": return <ProductsPage />;
      case "stock": return <StockPage />;
      case "history": return <SalesHistoryPage />;
      case "reports": return <ReportsPage preset={reportPeriod} onNavigate={navigate} />;
      case "repairs": return <RepairsPage onNavigate={navigate} />;
      case "backup": return <BackupPage />;
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <TopNav currentPage={page} onNavigate={navigate} />
      <main className="mx-auto max-w-[1680px] px-4 py-4 lg:px-6">
        <PageGuide page={page} />
        {renderPage()}
      </main>
    </div>
  );
}
