import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DemandMonitoring from "./pages/DemandMonitoring";
import ReactiveMonitoring from "./pages/ReactiveMonitoring";
import SmartSensors from "./pages/SmartSensors";
import BillAnalyzer from "./components/BillAnalyzer";
import MarketSimulation from "./pages/MarketSimulation";
import IndustrySettings from "./pages/IndustrySettings";
import ServiceProviders from "./pages/ServiceProviders";
import Documents from "./pages/Documents";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/demanda" element={<DemandMonitoring />} />
          <Route path="/reativo" element={<ReactiveMonitoring />} />
          <Route path="/sensores" element={<SmartSensors />} />
          <Route path="/faturas" element={<BillAnalyzer />} />
          <Route path="/mercado-livre" element={<MarketSimulation />} />
          <Route path="/configuracoes" element={<IndustrySettings />} />
          <Route path="/prestadores" element={<ServiceProviders />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}