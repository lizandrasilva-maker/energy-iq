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
import { initialEquipments } from "../data/plant";
import { faturaReferencia as ref } from "../data/faturaReferencia";

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
  const [targetFP, setTargetFP] = useState("0,95");
  const [energyTariff, setEnergyTariff] = useState("0,85");
  const [reactiveTariff, setReactiveTariff] = useState("0,15");
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
    document.getElementById("simulador-capacitores")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

    // Margem de segurança de 5%. A partir de 1 kvar, arredonda para o kvar
    // inteiro acima; abaixo disso (cargas pequenas) mantém o valor em var.
    const withMargin = qcKvar * 1.05;
    const recommendedKvar = withMargin >= 1 ? Math.ceil(withMargin) : withMargin;

    // Estimativa de economia mensal de excedente reativo
    const estimatedMonthlySavings = (p * (tan1 - tan2) * 220 * (tReact || 0.15));

    setResult({
      exactKvar: qcKvar,
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

      {/* FP por setor (sensores) */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Fator de potência por setor</h2>
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

      {/* Reativo na fatura de referência (real, anonimizada) */}
      {(() => {
        const itens = ref.itens.filter((i) => i.componente === "reativo");
        const valor = itens.reduce((t, i) => t + i.valor, 0);
        const fp = itens.find((i) => /fora/i.test(i.descricao));
        const p = itens.find((i) => !/fora/i.test(i.descricao));
        const pctConta = valor / ref.subtotalFaturamento;
        const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const cards = [
          { label: "Valor cobrado no mês", value: brl(valor), note: `${(pctConta * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da conta de energia` },
          { label: "Excedente fora de ponta", value: `${fp.quantidade.toLocaleString("pt-BR")} kVArh`, note: brl(fp.valor) },
          { label: "Excedente na ponta", value: `${p.quantidade.toLocaleString("pt-BR")} kVArh`, note: brl(p.valor) },
          { label: "Por ano, se repetir", value: brl(valor * 12), note: "Estimativa simples: 12 × o mês" },
        ];
        return (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
              <h2 className="text-base font-bold text-slate-900">Reativo na fatura</h2>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                fatura real anonimizada · {ref.referencia.split("-").reverse().join("/")}
              </span>
            </div>
            <p className="text-xs text-slate-500 -mt-4">
              Indústria {ref.subgrupo} {ref.modalidade} da {ref.distribuidora}. O excedente é apurado hora a hora quando o fator de
              potência fica abaixo de 0,92, por isso aparece mesmo em meses com FP médio alto.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div key={c.label} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                  <p className="font-heading text-2xl font-bold text-slate-900 mt-1 tabular-nums">{c.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{c.note}</p>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* CALCULADORA DE BANCO DE CAPACITORES (POSICIONADA LOGO ABAIXO DO GRÁFICO) */}
      <div id="simulador-capacitores" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4">
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
                  {formatReactive(result.recommendedKvar)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Potência reativa necessária (cálculo exato: {formatReactive(result.exactKvar)}, mais 5% de margem)
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