import { useState, useMemo, useEffect } from "react";
import { streamRecent, fetchSensorRows, subscribeMeasurements, isOnline, SOURCE_LABEL } from "../lib/telemetry";
import { Plus, Cpu, Zap, TrendingDown, Factory, Clock, X, Check, Building2, BarChart2, Activity, Gauge, Calendar, Radio, Waves } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  useChartTheme, AreaGradient, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, barCursor, activeDot, formatMonth,
} from "../components/charts/ChartKit";

import {
  wattsToKw, formatPower, formatReactive, reactiveKvar, apparentKva,
  aggregateEnergy, isPlausibleReading, harmonicsFor, LOAD_TYPES,
} from "../lib/electrical";
import { initialSectors, initialEquipments } from "../data/plant";

// Pontos guardados por sensor para a curva ao vivo
const LIVE_POINTS = 30;
// Leituras buscadas para o histórico (as mais recentes)
const HISTORY_LIMIT = 5000;

const timeLabel = (iso) =>
  new Date(iso || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** "14:09:16" se for hoje; "12/10 21:45" se for de outro dia. */
const whenLabel = (iso) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? timeLabel(iso)
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const toLivePoint = (row) => ({
  time: timeLabel(row.created_at),
  power: wattsToKw(row.power) ?? 0,
  pf: row.power_factor ?? null,
  current: row.current ?? null,
});

/**
 * Aplica a leitura de um sensor ao equipamento correspondente. Uma leitura
 * mais antiga que a atual (vinda da outra fonte) é ignorada: vale quem
 * enviou por último.
 */
const applyReading = (eq, row) =>
  eq.lastReadingAt && Date.parse(row.created_at) < Date.parse(eq.lastReadingAt) ? eq : ({
  ...eq,
  powerKw: wattsToKw(row.power) ?? eq.powerKw,
  voltage: row.voltage ?? eq.voltage,
  current: row.current ?? eq.current,
  pf: row.power_factor ?? eq.pf,
  // THD só existe se o medidor enviar (o PZEM-004T não mede harmônicas)
  thdCurrent: row.thd_current ?? eq.thdCurrent ?? null,
  thdVoltage: row.thd_voltage ?? eq.thdVoltage ?? null,
  lastReadingAt: row.created_at,
  source: row.source,
  measured: true,
});

export default function SmartSensors() {
  const [sectors, setSectors] = useState(initialSectors);
  const [equipments, setEquipments] = useState(initialEquipments);
  const [liveHistory, setLiveHistory] = useState({}); // sensorId -> pontos
  const [sourcesDown, setSourcesDown] = useState([]); // fontes que não responderam
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const chart = useChartTheme();

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selectedAnalysisEquip = equipments.find((e) => e.id === selectedId) || null;

  const [comparePeriod, setComparePeriod] = useState("daily");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyState, setHistoryState] = useState("idle"); // idle | loading | ready | error

  const [name, setName] = useState("");
  const [sector, setSector] = useState(initialSectors[0]);
  const [cls, setCls] = useState("A");
  const [powerKw, setPowerKw] = useState("");
  const [dailyHours, setDailyHours] = useState("");
  const [sensorIdInput, setSensorIdInput] = useState("");
  const [loadTypeInput, setLoadTypeInput] = useState("Geral");

  const [newSectorName, setNewSectorName] = useState("");

  useEffect(() => {
    // 1. Últimas leituras das duas fontes (nova versão + protótipo original).
    // Cada fonte é aplicada assim que responde; uma fora do ar não trava a outra.
    const received = [];
    const stopStream = streamRecent(
      200,
      (sourceRows) => {
        received.push(...sourceRows.filter(isPlausibleReading));
        const rows = [...received].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
        const bySensor = {};
        rows.forEach((row) => {
          (bySensor[row.sensor_id] ||= []).push(row);
        });
        setEquipments((prev) =>
          prev.map((eq) => {
            const list = bySensor[eq.sensorId];
            return list ? applyReading(eq, list[list.length - 1]) : eq;
          })
        );
        setLiveHistory(
          Object.fromEntries(
            Object.entries(bySensor).map(([id, list]) => [id, list.slice(-LIVE_POINTS).map(toLivePoint)])
          )
        );
      },
      (failed) => setSourcesDown(failed)
    );

    // 2. Novas leituras em tempo real, de qualquer uma das fontes
    const stopLive = subscribeMeasurements((row) => {
      if (!isPlausibleReading(row)) return;
      setEquipments((prev) => prev.map((eq) => (eq.sensorId === row.sensor_id ? applyReading(eq, row) : eq)));
      setLiveHistory((prev) => ({
        ...prev,
        [row.sensor_id]: [...(prev[row.sensor_id] || []), toLivePoint(row)].slice(-LIVE_POINTS),
      }));
      setNow(Date.now());
    });
    return () => {
      stopStream();
      stopLive();
    };
  }, []);

  // Histórico do sensor do equipamento aberto, juntando as duas fontes
  // (busca uma vez por sensor; trocar o período só reagrupa os dados)
  const selectedSensorId = selectedAnalysisEquip?.sensorId || null;
  useEffect(() => {
    if (!selectedSensorId) {
      setHistoryRows([]);
      setHistoryState("idle");
      return;
    }
    let cancelled = false;
    setHistoryState("loading");
    fetchSensorRows(selectedSensorId, HISTORY_LIMIT)
      .then(({ rows }) => {
        if (cancelled) return;
        setHistoryRows(rows);
        setHistoryState("ready");
      })
      .catch(() => {
        if (!cancelled) setHistoryState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSensorId]);

  const historicalData = useMemo(() => aggregateEnergy(historyRows, comparePeriod), [historyRows, comparePeriod]);

  const activeCount = equipments.filter((e) => e.status === "Ativo").length;
  const totalPower = equipments.reduce((acc, curr) => acc + curr.powerKw, 0);

  const totalMonthlyConsumption = equipments.reduce((acc, curr) => {
    return acc + curr.powerKw * curr.dailyHours * 30;
  }, 0);

  const sectorData = useMemo(() => {
    return sectors.map((sec) => {
      const consumption = equipments
        .filter((e) => e.sector === sec)
        .reduce((acc, curr) => acc + curr.powerKw * curr.dailyHours * 30, 0);
      return { sector: sec, consumption };
    });
  }, [equipments, sectors]);

  const handleAddEquipment = (e) => {
    e.preventDefault();
    if (!name || !powerKw || !dailyHours) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const newEquip = {
      id: Date.now(),
      name,
      sector: sector || sectors[0],
      class: cls,
      powerKw: parseFloat(powerKw),
      dailyHours: parseFloat(dailyHours),
      status: "Ativo",
      voltage: 220,
      current: Math.round(((parseFloat(powerKw) * 1000) / 220) * 10) / 10,
      pf: 0.92,
      loadType: loadTypeInput,
      sensorId: sensorIdInput.trim() || null,
    };

    setEquipments([...equipments, newEquip]);
    setName("");
    setPowerKw("");
    setDailyHours("");
    setSensorIdInput("");
    setLoadTypeInput("Geral");
    setIsEquipModalOpen(false);
  };

  const handleAddSector = (e) => {
    e.preventDefault();
    const trimmedName = newSectorName.trim();
    if (!trimmedName) return;

    if (sectors.some((s) => s.toLowerCase() === trimmedName.toLowerCase())) {
      alert("Este setor já está cadastrado.");
      return;
    }

    setSectors([...sectors, trimmedName]);
    setNewSectorName("");
    setIsSectorModalOpen(false);
  };

  const getClassBadgeStyle = (c) => {
    switch (c) {
      case "A": return "bg-emerald-500 text-white";
      case "B": return "bg-emerald-400 text-white";
      case "C": return "bg-amber-400 text-white";
      default: return "bg-slate-400 text-white";
    }
  };

  return (
    <div className="lg:p-6 space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sensores Inteligentes</h1>
          <p className="text-sm text-slate-500">Monitoramento em tempo real de equipamentos e setores</p>
          {sourcesDown.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Fora do ar agora: {sourcesDown.map((id) => SOURCE_LABEL[id] || id).join(" e ")}. Mostrando os dados da outra fonte.
            </p>
          )}
        </div>

        <div className="flex w-full sm:w-auto items-center gap-3">
          <button
            onClick={() => setIsSectorModalOpen(true)}
            className="flex-1 sm:flex-none justify-center whitespace-nowrap px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Novo Setor</span>
          </button>

          <button
            onClick={() => setIsEquipModalOpen(true)}
            className="flex-1 sm:flex-none justify-center whitespace-nowrap px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Equipamento</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-sky-50/30 rounded-2xl border border-sky-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Equipamentos Ativos</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {activeCount} <span className="text-sm font-normal text-slate-500">de {equipments.length}</span>
            </p>
          </div>
          <div className="p-2.5 bg-sky-100/60 text-sky-600 rounded-xl">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Potência Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatPower(totalPower)}
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Consumo Mensal Est.</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {totalMonthlyConsumption.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Setores Monitorados</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{sectors.length}</p>
          </div>
          <div className="p-2.5 bg-emerald-100/60 text-emerald-600 rounded-xl">
            <Factory className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Comparativo por Setor</h2>
        <p className="text-xs text-slate-500 mb-6">Consumo mensal estimado por setor (kWh)</p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorData} barCategoryGap="38%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <AreaGradient id="sens-setor" color={chart.series[0]} from={1} to={0.55} />
              </defs>
              <CartesianGrid {...gridProps(chart)} />
              <XAxis dataKey="sector" {...axisProps(chart)} />
              <YAxis {...axisProps(chart)} width={56} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
              <Tooltip
                cursor={barCursor(chart)}
                content={<ChartTooltip format={(v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh/mês`} />}
              />
              <Bar dataKey="consumption" name="Consumo estimado" fill="url(#sens-setor)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Equipamentos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipments.map((item) => {
            const monthlyKw = (item.powerKw * item.dailyHours * 30).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
            return (
              <div
                key={item.id}
                className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{item.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{item.sector}</p>
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold ${getClassBadgeStyle(
                        item.class
                      )}`}
                    >
                      {item.class}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-500 border-b border-slate-100 pb-4 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-slate-400" /> Potência
                      </span>
                      <span className="font-semibold text-slate-800">{formatPower(item.powerKw)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 text-slate-400" /> Sensor
                      </span>
                      {item.sensorId ? (
                        <span className="text-right" title={item.measured ? `Última leitura: ${whenLabel(item.lastReadingAt)}` : "Sem leituras recebidas"}>
                          <span className="font-semibold text-slate-700">{item.sensorId}</span>{" "}
                          {!item.measured ? (
                            <span className="text-slate-400">• sem dados</span>
                          ) : isOnline(item.lastReadingAt, now) ? (
                            <span className="font-semibold text-emerald-600">• online</span>
                          ) : (
                            <span className="text-slate-500">• offline</span>
                          )}
                          {item.measured && (
                            <span className="block text-[10px] text-slate-400">{SOURCE_LABEL[item.source] || item.source}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">Não vinculado</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Uso diário
                      </span>
                      <span className="font-semibold text-slate-800">{item.dailyHours}h</span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span>Consumo/mês</span>
                      <span className="font-bold text-slate-900">{monthlyKw} kWh</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full border border-emerald-100">
                    {item.status}
                  </span>

                  <button
                    onClick={() => setSelectedId(item.id)}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    <span>Análise</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedAnalysisEquip && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 space-y-6 animate-fadeIn max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{selectedAnalysisEquip.name}</h3>
                  <span className="px-2.5 py-0.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-md">
                    {selectedAnalysisEquip.sensorId || "Sem sensor"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Setor: <span className="font-semibold">{selectedAnalysisEquip.sector}</span> | Tipo: <span className="font-semibold">{selectedAnalysisEquip.loadType}</span>
                  {selectedAnalysisEquip.measured
                    ? <> | Última leitura: <span className="font-semibold">{whenLabel(selectedAnalysisEquip.lastReadingAt)}</span>{" "}
                        ({isOnline(selectedAnalysisEquip.lastReadingAt, now) ? "online" : "offline"}, fonte: {SOURCE_LABEL[selectedAnalysisEquip.source] || selectedAnalysisEquip.source})</>
                    : <> | <span className="font-semibold text-amber-600">valores de exemplo (sem leitura do sensor)</span></>}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const eq = selectedAnalysisEquip;
              const q = reactiveKvar(eq.powerKw, eq.pf);
              const sKva = apparentKva(eq.powerKw, eq.pf);
              const monthlyCost = eq.powerKw * eq.dailyHours * 30 * 0.75;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-sky-500" /> Potência ativa
                      </p>
                      <p className="text-lg font-bold text-slate-900 mt-1">{formatPower(eq.powerKw)}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-sky-500" /> Fator de potência
                      </p>
                      <p className={`text-lg font-bold mt-1 ${eq.pf < 0.92 ? "text-amber-600" : "text-emerald-600"}`}>
                        {Number(eq.pf).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1" title="Calculada por Q = P · tan(acos FP). O PZEM-004T não mede reativa diretamente.">
                        <Activity className="h-3 w-3 text-purple-500" /> Reativa (estimada)
                      </p>
                      <p className="text-lg font-bold text-slate-900 mt-1">{formatReactive(q)}</p>
                      <p className="text-[10px] text-slate-400">S = {formatPower(sKva).replace("W", "VA")}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" /> Tensão / Corrente
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {Number(eq.voltage).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} V / {Number(eq.current).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} A
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 text-[11px]">
                    <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-start gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-px" />
                      <span>
                        Custo mensal estimado: <b className="text-slate-700">R$ {monthlyCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> ({eq.dailyHours} h/dia a R$ 0,75/kWh)
                      </span>
                    </div>
                    {(() => {
                      const h = harmonicsFor(eq);
                      const pct = (v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} %`;
                      return (
                        <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-start gap-1.5">
                          <Waves className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-px" />
                          <span>
                            Harmônicas (THD de corrente):{" "}
                            {h.mode === "real" ? (
                              <>
                                <b className="text-slate-700">{h.thdCurrent !== null ? pct(h.thdCurrent) : "—"}</b>
                                {h.thdVoltage !== null && <> · tensão <b className="text-slate-700">{pct(h.thdVoltage)}</b></>}{" "}
                                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">Medida</span>
                              </>
                            ) : (
                              <>
                                <b className="text-slate-700">~{pct(h.thdCurrent)}</b>{" "}
                                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">Simulada</span>
                                <span className="block mt-0.5">
                                  Faixa típica {h.range[0]}–{h.range[1]} % para carga {eq.loadType || "Geral"} ({h.note}). Para o valor real é preciso um medidor de harmônicas; o PZEM-004T não mede.
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">Curva de Carga em Tempo Real</h4>
              <p className="text-xs text-slate-400 mb-4">Variação instantânea enviada pelo ESP32</p>

              {(() => {
                const points = liveHistory[selectedAnalysisEquip.sensorId] || [];
                if (!selectedAnalysisEquip.sensorId || points.length === 0) {
                  return (
                    <div className="h-44 w-full rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center px-4">
                      {selectedAnalysisEquip.sensorId
                        ? `Nenhuma leitura recente de ${selectedAnalysisEquip.sensorId}. A curva aparece assim que o sensor enviar dados.`
                        : "Vincule um sensor a este equipamento para ver a curva de carga."}
                    </div>
                  );
                }
                const inWatts = Math.max(...points.map((p) => p.power)) < 1;
                const data = points.map((p) => ({ ...p, value: inWatts ? p.power * 1000 : p.power }));
                const unit = inWatts ? "W" : "kW";
                return (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <AreaGradient id="sens-live" color={chart.series[0]} />
                        </defs>
                        <CartesianGrid {...gridProps(chart)} />
                        <XAxis dataKey="time" {...axisProps(chart)} minTickGap={32} />
                        <YAxis {...axisProps(chart)} width={60} unit={` ${unit}`} />
                        <Tooltip
                          cursor={lineCursor(chart)}
                          content={<ChartTooltip format={(v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`} />}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name="Potência ativa"
                          stroke={chart.series[0]}
                          strokeWidth={2}
                          fill="url(#sens-live)"
                          activeDot={activeDot(chart, chart.series[0])}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-sky-600" />
                    Análise e Comparação de Consumo
                  </h4>
                  <p className="text-xs text-slate-400">Energia calculada a partir das leituras do sensor</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setComparePeriod("daily")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      comparePeriod === "daily" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Diário
                  </button>
                  <button
                    onClick={() => setComparePeriod("weekly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      comparePeriod === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Semanal
                  </button>
                  <button
                    onClick={() => setComparePeriod("monthly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      comparePeriod === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Mensal
                  </button>
                </div>
              </div>

              {(() => {
                const empty = (msg) => (
                  <div className="h-52 w-full mt-2 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center px-4">{msg}</div>
                );
                if (!selectedAnalysisEquip.sensorId) return empty("Sem sensor vinculado: não há histórico medido.");
                if (historyState === "loading") return empty("Carregando leituras…");
                if (historyState === "error") return empty("Não foi possível carregar o histórico. Tente abrir de novo.");
                if (!historicalData.length) return empty(`Ainda não há leituras de ${selectedAnalysisEquip.sensorId}.`);
                const inWh = Math.max(...historicalData.map((d) => d.energyKwh)) < 1;
                const data = historicalData.map((d) => ({ ...d, energy: inWh ? d.energyKwh * 1000 : d.energyKwh }));
                const eUnit = inWh ? "Wh" : "kWh";
                return (
                  <div className="h-52 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} barCategoryGap="35%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <AreaGradient id="sens-hist" color={chart.series[0]} from={1} to={0.55} />
                        </defs>
                        <CartesianGrid {...gridProps(chart)} />
                        <XAxis dataKey="periodLabel" {...axisProps(chart)} />
                        <YAxis {...axisProps(chart)} width={64} unit={` ${eUnit}`} />
                        <Tooltip
                          cursor={barCursor(chart)}
                          content={
                            <ChartTooltip
                              labelFormat={(l, rows) => `${l} • ${rows?.[0]?.payload?.samples ?? 0} leituras`}
                              format={(v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${eUnit}`}
                              extra={(d) => `Potência média: ${formatPower(d.avgPowerKw)}`}
                            />
                          }
                        />
                        <Bar dataKey="energy" name="Energia" fill="url(#sens-hist)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-sky-900">Análise do Perfil Elétrico:</p>
              {selectedAnalysisEquip.pf < 0.92 ? (
                <p className="text-amber-800">
                  ⚠️ <strong>Atenção:</strong> Fator de potência {selectedAnalysisEquip.measured ? "medido" : "de exemplo"} ({Number(selectedAnalysisEquip.pf).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) está abaixo do limite regulatório de 0,92. É recomendável o dimensionamento de um banco de capacitores ou correção local.
                </p>
              ) : (
                <p className="text-emerald-800">
                  ✅ <strong>Eficiência Elevada:</strong> O equipamento opera dentro da faixa ideal de fator de potência ({Number(selectedAnalysisEquip.pf).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), apresentando baixo desperdício por energia reativa.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEquipModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Cadastrar Novo Equipamento</h3>
              <button
                onClick={() => setIsEquipModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome do Equipamento *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Torno CNC Vertical"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Setor</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {sectors.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Classe</label>
                  <select
                    value={cls}
                    onChange={(e) => setCls(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="A">Classe A</option>
                    <option value="B">Classe B</option>
                    <option value="C">Classe C</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Potência (kW) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 2.5"
                    value={powerKw}
                    onChange={(e) => setPowerKw(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uso Diário (Horas) *
                  </label>
                  <input
                    type="number"
                    max="24"
                    placeholder="Ex: 12"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="equip-load-type" className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de carga
                </label>
                <select
                  id="equip-load-type"
                  value={loadTypeInput}
                  onChange={(e) => setLoadTypeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  {LOAD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Usado para simular as harmônicas enquanto não houver medição real.</p>
              </div>

              <div>
                <label htmlFor="equip-sensor-id" className="block text-xs font-medium text-slate-700 mb-1">
                  ID do sensor (opcional)
                </label>
                <input
                  id="equip-sensor-id"
                  type="text"
                  placeholder="Ex: ESP32_PZEM_04"
                  value={sensorIdInput}
                  onChange={(e) => setSensorIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">O mesmo identificador gravado no firmware do ESP32 (campo sensor_id).</p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEquipModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  <span>Cadastrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSectorModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Cadastrar Novo Setor</h3>
              <button
                onClick={() => setIsSectorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSector} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome do Setor *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pintura, Embalagem..."
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSectorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  <span>Cadastrar Setor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}