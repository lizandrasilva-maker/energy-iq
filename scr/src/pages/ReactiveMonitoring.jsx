import { useState } from "react";
import { 
  AlertTriangle, 
  X, 
  Activity, 
  Zap, 
  TrendingDown, 
  Calculator, 
  PhoneCall, 
  CheckCircle2 
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from "recharts";

// Dados para o gráfico de evolução do Fator de Potência
const fpHistoryData = [
  { month: "Ago/25", fp: 0.88 },
  { month: "Set/25", fp: 0.86 },
  { month: "Out/25", fp: 0.84 },
  { month: "Nov/25", fp: 0.82 },
  { month: "Dez/25", fp: 0.83 },
  { month: "Jan/26", fp: 0.81 },
  { month: "Fev/26", fp: 0.85 },
  { month: "Mar/26", fp: 0.84 },
  { month: "Abr/26", fp: 0.83 },
  { month: "Mai/26", fp: 0.85 },
  { month: "Jun/26", fp: 0.86 },
  { month: "Jul/26", fp: 0.84 },
];

export default function ReactiveMonitoring() {
  const [showAlert, setShowAlert] = useState(true);

  // Estados da Calculadora
  const [activePower, setActivePower] = useState("");
  const [currentFP, setCurrentFP] = useState("");
  const [targetFP, setTargetFP] = useState("0,95");
  const [energyTariff, setEnergyTariff] = useState("0,85");
  const [reactiveTariff, setReactiveTariff] = useState("0,15");
  const [result, setResult] = useState(null);

  // Função de cálculo fiel do Banco de Capacitores
  const calculateSizing = (e) => {
    e.preventDefault();

    const p = parseFloat(activePower.replace(",", "."));
    const fp1 = parseFloat(currentFP.replace(",", "."));
    const fp2 = parseFloat(targetFP.replace(",", "."));
    const tReact = parseFloat(reactiveTariff.replace(",", "."));

    if (!p || !fp1 || !fp2 || fp1 <= 0 || fp1 >= 1 || fp2 <= fp1 || fp2 > 1) {
      alert("Por favor, preencha valores válidos para Potência Ativa e Fatores de Potência (entre 0.01 e 0.99).");
      return;
    }

    // Cálculo exato: Qc = P * (tan(acos(fp1)) - tan(acos(fp2)))
    const tan1 = Math.tan(Math.acos(fp1));
    const tan2 = Math.tan(Math.acos(fp2));
    const qcKvar = p * (tan1 - tan2);

    // Margem de segurança standard (+5%)
    const recommendedKvar = Math.ceil(qcKvar * 1.05);

    // Estimativa de economia mensal de excedente reativo
    const estimatedMonthlySavings = (p * (tan1 - tan2) * 220 * (tReact || 0.15));

    setResult({
      exactKvar: qcKvar.toFixed(2),
      recommendedKvar: recommendedKvar,
      monthlySavings: estimatedMonthlySavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      powerP: p,
      fp1: fp1,
      fp2: fp2
    });
  };

  const handleContactSupplier = () => {
    const message = `Olá! Gostaria de um orçamento para instalação de Banco de Capacitores.
- Potência Ativa: ${result?.powerP} kW
- Fator de Potência Atual: ${result?.fp1}
- Fator de Potência Desejado: ${result?.fp2}
- Dimensionamento Calculado: ${result?.recommendedKvar} kVAr`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="lg:p-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitoramento de Reativo</h1>
        <p className="text-sm text-slate-500">Fator de potência e simulação de banco de capacitores</p>
      </div>

      {/* Alerta de FP Baixo */}
      {showAlert && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start justify-between text-amber-800 text-sm shadow-sm transition-all">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Fator de potência abaixo de 0,92</p>
              <p className="text-amber-700/90 text-xs mt-0.5">
                Sua instalação pode estar gerando excedentes de energia reativa, resultando em cobranças adicionais na fatura.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowAlert(false)} 
            className="text-amber-500 hover:text-amber-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Fator de Potência Médio</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">0.84</p>
          </div>
          <div className="p-2.5 bg-amber-100/60 text-amber-600 rounded-xl">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Meses com FP Baixo</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              12 <span className="text-sm font-normal text-slate-500">de 12</span>
            </p>
          </div>
          <div className="p-2.5 bg-amber-100/60 text-amber-600 rounded-xl">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Último Reativo</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              111000 <span className="text-sm font-normal text-slate-500">kVArh</span>
            </p>
          </div>
          <div className="p-2.5 bg-slate-200/60 text-slate-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Último FP</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">0.84</p>
          </div>
          <div className="p-2.5 bg-rose-100/60 text-rose-500 rounded-xl">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução do Fator de Potência */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Evolução do Fator de Potência</h2>
        <p className="text-xs text-slate-500 mb-6">Mínimo recomendado: 0,92</p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fpHistoryData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis domain={[0.75, 1.0]} stroke="#94a3b8" fontSize={12} tickLine={false} />
              <Tooltip cursor={{ stroke: "#f1f5f9" }} />
              <ReferenceLine y={0.92} stroke="#dc2626" strokeDasharray="4 4" />
              <Line 
                type="monotone" 
                dataKey="fp" 
                stroke="#1a8cff" 
                strokeWidth={2.5} 
                dot={{ fill: "#1a8cff", r: 4 }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CALCULADORA DE BANCO DE CAPACITORES (POSICIONADA LOGO ABAIXO DO GRÁFICO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-2.5 mb-6">
            <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
              <Calculator className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Simulação de Banco de Capacitores</h2>
          </div>

          <form onSubmit={calculateSizing} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Potência Ativa (kW)
              </label>
              <input
                type="text"
                placeholder="Ex: 500"
                value={activePower}
                onChange={(e) => setActivePower(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fator de Potência Atual
                </label>
                <input
                  type="text"
                  placeholder="Ex: 0.82"
                  value={currentFP}
                  onChange={(e) => setCurrentFP(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fator de Potência Desejado
                </label>
                <input
                  type="text"
                  value={targetFP}
                  onChange={(e) => setTargetFP(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tarifa Energia (R$/kWh)
                </label>
                <input
                  type="text"
                  value={energyTariff}
                  onChange={(e) => setEnergyTariff(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tarifa Reativo (R$/kVArh)
                </label>
                <input
                  type="text"
                  value={reactiveTariff}
                  onChange={(e) => setReactiveTariff(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer"
            >
              <Calculator className="h-4 w-4" />
              <span>Calcular Dimensionamento</span>
            </button>
          </form>
        </div>

        {/* Display do Resultado */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center">
          {!result ? (
            <div className="text-center p-6 space-y-3">
              <div className="inline-flex p-4 bg-slate-50 text-slate-300 rounded-2xl border border-slate-100">
                <Calculator className="h-10 w-10 stroke-[1.5]" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Preencha os dados ao lado para ver a simulação
              </p>
            </div>
          ) : (
            <div className="w-full space-y-5 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Dimensionamento Calculado
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-3">
                  {result.recommendedKvar} <span className="text-base font-normal text-slate-500">kVAr</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Potência reativa necessária (Cálculo exato: {result.exactKvar} kVAr)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <p className="text-slate-500">Correção do FP:</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{result.fp1} ➔ {result.fp2}</p>
                </div>
                <div>
                  <p className="text-slate-500">Economia Est. Excedente:</p>
                  <p className="font-semibold text-emerald-600 mt-0.5">{result.monthlySavings} / mês</p>
                </div>
              </div>

              <button
                onClick={handleContactSupplier}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                <PhoneCall className="h-4 w-4" />
                <span>Contactar Fornecedor para Instalação</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}