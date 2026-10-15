import { useEffect, useMemo, useState } from "react";
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
import {
  useChartTheme, AreaGradient, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, barCursor, activeDot, formatMonth,
} from "../components/charts/ChartKit";
import { fetchRecent } from "../lib/telemetry";
import { pfSummary, capacitorKvar, formatPower, formatReactive, PF_MIN } from "../lib/electrical";
import { parseNumberBR } from "../lib/billParsing";
import { initialEquipments } from "../data/plant";
import { faturaReferencia as ref } from "../data/faturaReferencia";
import ReactiveSummary from "../components/ReactiveSummary";
import InfoTip from "../components/ui/InfoTip";

// Janela analisada por sensor: as 24 h que terminam na última leitura dele
const WINDOW_MS = 24 * 3600 * 1000;
const fmtPf = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ReactiveMonitoring() {
  const [showAlert, setShowAlert] = useState(true);
  const chart = useChartTheme();

  // Estados da Calculadora
  const [activePower, setActivePower] = useState("");
  const [currentFP, setCurrentFP] = useState("");
  const [targetFP, setTargetFP] = useState("0,92");
  const [monthlyEnergy, setMonthlyEnergy] = useState("");
  // Valor do kVArh excedente com tributos, como cobrado na fatura de referência
  const [reactiveTariff, setReactiveTariff] = useState(
    ref.itens.find((i) => i.componente === "reativo").precoComTributos.toLocaleString("pt-BR", { maximumFractionDigits: 5 })
  );
  const [formError, setFormError] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState(null);

  // FP por setor a partir das leituras dos sensores
  const [sensorRows, setSensorRows] = useState([]);
  const [sensorState, setSensorState] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    // Duas fontes (nova versão + protótipo original); vale a leitura mais recente
    fetchRecent(5000)
      .then(({ rows }) => {
        if (cancelled) return;
        setSensorRows(rows);
        setSensorState("ready");
      })
      .catch(() => {
        if (!cancelled) setSensorState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sectorPf = useMemo(() => {
    const bySensor = {};
    for (const r of sensorRows) (bySensor[r.sensor_id] ||= []).push(r);
    return initialEquipments
      .filter((eq) => eq.sensorId && bySensor[eq.sensorId])
      .map((eq) => {
        const rows = bySensor[eq.sensorId];
        const last = Date.parse(rows[0].created_at); // ordem decrescente
        const summary = pfSummary(rows.filter((r) => Date.parse(r.created_at) >= last - WINDOW_MS));
        return summary && { eq, ...summary, kvarTo092: capacitorKvar(summary.avgPowerKw, summary.pf) };
      })
      .filter(Boolean)
      .sort((a, b) => a.pf - b.pf);
  }, [sensorRows]);
  const lowPf = sectorPf.filter((s) => s.pf < PF_MIN);

  /** Leva P e FP medidos do setor para a calculadora de capacitores. */
  const simulateSector = (s) => {
    setActivePower(s.avgPowerKw.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false }));
    setCurrentFP(fmtPf(s.pf));
    setTargetFP("0,92");
    setResult(null);
    setAdvancedOpen(true);
    setTimeout(() => document.getElementById("simulador-capacitores")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Banco de capacitores (Qc = P · (tg φ1 − tg φ2)) e custo do reativo excedente.
  // Excedente do mês ≈ energia × (0,92 / FP − 1), regra da REN ANEEL 1.000/2021
  // aplicada com o FP médio (a distribuidora apura hora a hora).
  const calculateSizing = (e) => {
    e.preventDefault();
    const n = (v) => parseNumberBR(v, NaN);
    const p = n(activePower), fp1 = n(currentFP), fp2 = n(targetFP), vr = n(reactiveTariff), energia = n(monthlyEnergy);

    if (!(p > 0)) return setFormError("Informe a potência ativa em kW (ex.: 500).");
    if (!(fp1 > 0 && fp1 < 1)) return setFormError("O fator de potência atual fica entre 0 e 1 (ex.: 0,82).");
    if (!(fp2 > fp1 && fp2 <= 1)) return setFormError("O fator de potência desejado precisa ser maior que o atual e no máximo 1 (o mínimo regulatório é 0,92).");
    setFormError(null);

    const tan1 = Math.tan(Math.acos(fp1));
    const tan2 = Math.tan(Math.acos(fp2));
    const qcKvar = p * (tan1 - tan2);

    // Margem de segurança de 5%. A partir de 1 kvar, arredonda para o kvar
    // inteiro acima; abaixo disso (cargas pequenas) mantém o valor em var.
    const withMargin = qcKvar * 1.05;
    const recommendedKvar = withMargin >= 1 ? Math.ceil(withMargin) : withMargin;

    const excedente = energia > 0 && fp1 < 0.92 ? energia * (0.92 / fp1 - 1) : energia > 0 ? 0 : null;
    const custoAtual = excedente != null && vr > 0 ? excedente * vr : null;
    const custoDepois = fp2 >= 0.92 ? 0 : custoAtual;

    setResult({
      exactKvar: qcKvar,
      recommendedKvar,
      excedente,
      custoAtual,
      economia: custoAtual != null ? custoAtual - custoDepois : null,
      powerP: p,
      fp1,
      fp2,
    });
  };

  const handleContactSupplier = () => {
    const message = `Olá! Gostaria de um orçamento para instalação de Banco de Capacitores.
- Potência Ativa: ${result?.powerP} kW
- Fator de Potência Atual: ${result?.fp1}
- Fator de Potência Desejado: ${result?.fp2}
- Dimensionamento Calculado: ${formatReactive(result?.recommendedKvar)}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="lg:p-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitoramento de Reativo</h1>
        <p className="text-sm text-slate-500">Fator de potência e simulação de banco de capacitores</p>
      </div>

      {/* Alerta calculado a partir dos sensores */}
      {showAlert && sensorState === "ready" && lowPf.length > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start justify-between text-amber-800 text-sm shadow-sm transition-all">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">
                {lowPf.length === 1 ? "1 setor" : `${lowPf.length} setores`} com fator de potência abaixo de 0,92
              </p>
              <p className="text-amber-700/90 text-xs mt-0.5">
                {lowPf.map((s) => `${s.eq.sector} (FP ${fmtPf(s.pf)})`).join(" · ")}. {lowPf.length === 1 ? "Esse setor aumenta" : "Esses setores aumentam"} o
                reativo excedente cobrado na fatura. Veja abaixo quanto de capacitor {lowPf.length === 1 ? "ele precisa" : "cada um precisa"}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAlert(false)}
            aria-label="Fechar alerta"
            className="text-amber-500 hover:text-amber-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Resposta para o cliente, a partir da fatura */}
      <ReactiveSummary
        fatura={ref}
        onVerSetores={() => document.getElementById("fp-por-setor")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      {/* FP por setor (sensores) */}
      <div id="fp-por-setor" className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm scroll-mt-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Onde o fator de potência está baixo</h2>
            <p className="text-xs text-slate-500">
              Medição dos sensores nas últimas 24 h de leitura de cada um. FP do período = energia ativa ÷ energia aparente.
            </p>
          </div>
        </div>

        {sensorState === "loading" && <p className="text-xs text-slate-400 py-6 text-center">Carregando leituras dos sensores…</p>}
        {sensorState === "error" && (
          <p className="text-xs text-rose-600 py-6 text-center">Não foi possível carregar as leituras dos sensores. Recarregue a página.</p>
        )}
        {sensorState === "ready" && sectorPf.length === 0 && (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nenhum sensor enviou leituras ainda. Assim que o ESP32 enviar dados, o FP de cada setor aparece aqui.
          </p>
        )}
        {sensorState === "ready" && sectorPf.length > 0 && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="font-semibold px-2 py-2">Setor / equipamento</th>
                  <th className="font-semibold px-2 py-2">FP</th>
                  <th className="font-semibold px-2 py-2">Potência média</th>
                  <th className="font-semibold px-2 py-2">Reativa (est.)</th>
                  <th className="font-semibold px-2 py-2">Capacitor p/ 0,92</th>
                  <th className="font-semibold px-2 py-2">Última leitura</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sectorPf.map((s) => (
                  <tr key={s.eq.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-slate-800">{s.eq.sector}</p>
                      <p className="text-xs text-slate-400">{s.eq.name} · {s.eq.sensorId}</p>
                    </td>
                    <td className="px-2 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.pf < PF_MIN ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                        {fmtPf(s.pf)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{formatPower(s.avgPowerKw)}</td>
                    <td className="px-2 py-3 text-slate-700">{formatReactive(s.reactiveKvar)}</td>
                    <td className="px-2 py-3 font-semibold text-slate-800">
                      {s.kvarTo092 > 0 ? formatReactive(s.kvarTo092) : <span className="text-emerald-600 font-medium">não precisa</span>}
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-500">{fmtTime(s.lastAt)}<br />{s.samples} leituras</td>
                    <td className="px-2 py-3 text-right">
                      {s.kvarTo092 > 0 && (
                        <button
                          type="button"
                          onClick={() => simulateSector(s)}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                        >
                          Simular capacitor
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sensorState === "ready" && sectorPf.some((s) => s.kvarTo092 > 0 && s.avgPowerKw < 1) && (
          <p className="text-[11px] text-slate-400 mt-3">
            Em cargas pequenas (abaixo de 1 kW), a correção local raramente compensa o custo: avalie o banco no quadro geral.
          </p>
        )}
      </div>

      {/* Simulação avançada do banco de capacitores (para técnicos) */}
      <details
        id="simulador-capacitores"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="group scroll-mt-4 rounded-2xl border border-slate-200 bg-white/50"
      >
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-3">
          <span>
            <span className="block text-base font-bold text-slate-900">Simulação avançada do banco de capacitores</span>
            <span className="block text-xs text-slate-500">Para técnicos e integradoras: dimensione com os seus próprios valores.</span>
          </span>
          <span className="text-xs font-semibold text-sky-600 whitespace-nowrap">{advancedOpen ? "Fechar" : "Abrir"}</span>
        </summary>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 pb-4">
        {/* Formulario */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-2.5 mb-6">
            <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
              <Calculator className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Simulação de Banco de Capacitores</h2>
          </div>

          <form onSubmit={calculateSizing} className="space-y-4" noValidate>
            <div>
              <label htmlFor="cap-p" className="block text-xs font-medium text-slate-700 mb-1">
                Potência ativa (kW){" "}
                <InfoTip>A potência que a carga consome trabalhando. Use a demanda medida da fatura ou a potência média do setor.</InfoTip>
              </label>
              <input
                type="text"
                id="cap-p"
                inputMode="decimal"
                placeholder="Ex.: 500"
                value={activePower}
                onChange={(e) => setActivePower(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cap-fp1" className="block text-xs font-medium text-slate-700 mb-1">
                  FP atual{" "}
                  <InfoTip>Fator de potência: quanto da energia vira trabalho (de 0 a 1). Abaixo de 0,92 há cobrança de reativo.</InfoTip>
                </label>
                <input
                  id="cap-fp1"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 0,82"
                  value={currentFP}
                  onChange={(e) => setCurrentFP(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label htmlFor="cap-fp2" className="block text-xs font-medium text-slate-700 mb-1">
                  FP desejado
                </label>
                <input
                  id="cap-fp2"
                  type="text"
                  inputMode="decimal"
                  value={targetFP}
                  onChange={(e) => setTargetFP(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cap-e" className="block text-xs font-medium text-slate-700 mb-1">
                  Consumo do mês (kWh){" "}
                  <InfoTip>Opcional. Com ele, a simulação estima quanto de reativo excedente você paga no mês.</InfoTip>
                </label>
                <input
                  id="cap-e"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 243.443"
                  value={monthlyEnergy}
                  onChange={(e) => setMonthlyEnergy(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label htmlFor="cap-vr" className="block text-xs font-medium text-slate-700 mb-1">
                  Valor do reativo (R$/kVArh){" "}
                  <InfoTip>Preço do kVArh excedente com tributos, como aparece na fatura (linha "Consumo reativo excedente").</InfoTip>
                </label>
                <input
                  id="cap-vr"
                  type="text"
                  inputMode="decimal"
                  value={reactiveTariff}
                  onChange={(e) => setReactiveTariff(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            {formError && <p role="alert" className="text-xs font-medium text-rose-600">{formError}</p>}
            <button
              type="submit"
              className="w-full mt-2 py-3 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer"
            >
              <Calculator className="h-4 w-4" />
              <span>Calcular</span>
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
                  {formatReactive(result.recommendedKvar)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tamanho do banco de capacitores (cálculo exato: {formatReactive(result.exactKvar)}, mais 5% de margem)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <p className="text-slate-500">Correção do FP:</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{result.fp1.toLocaleString("pt-BR")} ➔ {result.fp2.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-slate-500">Reativo excedente evitado:</p>
                  <p className="font-semibold text-emerald-600 mt-0.5">
                    {result.economia != null
                      ? `${result.economia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / mês`
                      : "informe o consumo do mês"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleContactSupplier}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                <PhoneCall className="h-4 w-4" />
                <span>Pedir orçamento pelo WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      </div>
      </details>
    </div>
  );
}