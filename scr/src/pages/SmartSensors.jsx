import { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Cpu, Zap, TrendingDown, Factory, Clock, X, Check, Building2, BarChart2, Activity, Gauge, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const initialSectors = ["Escritório Técnico", "Usinagem", "Processos Térmicos"];

const initialTelemetryHistory = {
  1: [
    { time: "08:00", power: 1.1, pf: 0.90, current: 5.4 },
    { time: "10:00", power: 1.2, pf: 0.90, current: 5.4 },
  ],
};

const mockCompareData = {
  daily: [
    { periodLabel: "Seg", totalEnergyKw: 12.4, avgPower: 1.1 },
    { periodLabel: "Ter", totalEnergyKw: 14.2, avgPower: 1.2 },
  ],
  weekly: [],
  monthly: []
};

const initialEquipments = [
  {
    id: 1,
    name: "Bancada de TI & Iluminação",
    sector: "Escritório Técnico",
    class: "A",
    powerKw: 1.2,
    dailyHours: 10,
    status: "Ativo",
    voltage: 220,
    current: 5.4,
    pf: 0.90,
    thd: "18%",
    loadType: "Eletrônica / Não Linear",
  },
  {
    id: 2,
    name: "Bomba de Refrigeração",
    sector: "Usinagem",
    class: "B",
    powerKw: 2.2,
    dailyHours: 16,
    status: "Ativo",
    voltage: 220,
    current: 12.5,
    pf: 0.82,
    thd: "4%",
    loadType: "Indutiva (Motor Monofásico)",
  },
  {
    id: 3,
    name: "Sistema de Secagem",
    sector: "Processos Térmicos",
    class: "A",
    powerKw: 4.5,
    dailyHours: 12,
    status: "Ativo",
    voltage: 220,
    current: 20.4,
    pf: 0.99,
    thd: "1.5%",
    loadType: "Resistiva Pura",
  },
];

export default function SmartSensors() {
  const [sectors, setSectors] = useState(initialSectors);
  const [equipments, setEquipments] = useState(initialEquipments);
  const [telemetryHistory, setTelemetryHistory] = useState(initialTelemetryHistory);
  
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [selectedAnalysisEquip, setSelectedAnalysisEquip] = useState(null);

  const [comparePeriod, setComparePeriod] = useState("daily");
  const [historicalData, setHistoricalData] = useState([]);

  const [name, setName] = useState("");
  const [sector, setSector] = useState(initialSectors[0]);
  const [cls, setCls] = useState("A");
  const [powerKw, setPowerKw] = useState("");
  const [dailyHours, setDailyHours] = useState("");

  const [newSectorName, setNewSectorName] = useState("");

  const parseSensorId = (sensorId) => {
    if (sensorId === "ESP32_PZEM_01") return 1;
    if (sensorId === "ESP32_PZEM_02") return 2;
    if (sensorId === "ESP32_PZEM_03") return 3;
    const parsed = Number(sensorId);
    return isNaN(parsed) ? 1 : parsed;
  };

  useEffect(() => {
    // 1. Busca os últimos dados ao carregar a página
    const fetchInitialTelemetry = async () => {
      try {
        const { data } = await supabase
          .from("measurements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          const historyMap = {};
          
          const latestRow = data[0];
          const latestTargetId = parseSensorId(latestRow.sensor_id);
          const latestKw = latestRow.power > 50 ? latestRow.power / 1000 : latestRow.power;

          setEquipments((prev) =>
            prev.map((eq) => {
              if (eq.id === latestTargetId) {
                return {
                  ...eq,
                  powerKw: latestKw ?? eq.powerKw,
                  voltage: latestRow.voltage ?? eq.voltage,
                  current: latestRow.current ?? eq.current,
                  pf: latestRow.power_factor ?? eq.pf,
                };
              }
              return eq;
            })
          );

          data.slice().reverse().forEach((row) => {
            const eqId = parseSensorId(row.sensor_id);
            if (!historyMap[eqId]) historyMap[eqId] = [];
            
            const timeStr = new Date(row.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const kwVal = row.power > 50 ? row.power / 1000 : row.power;

            historyMap[eqId].push({
              time: timeStr,
              power: kwVal ?? 0,
              pf: row.power_factor ?? 1,
              current: row.current ?? 0,
            });
          });

          setTelemetryHistory((prev) => ({ ...prev, ...historyMap }));
        }
      } catch (err) {
        console.error("Erro ao carregar telemetria:", err);
      }
    };

    fetchInitialTelemetry();

    // 2. Escuta novos INSERTs do Supabase em tempo real
    const channel = supabase
      .channel("esp32-realtime-measurements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "measurements" },
        (payload) => {
          const data = payload.new;
          if (!data) return;

          const targetId = parseSensorId(data.sensor_id);
          const realKw = data.power > 50 ? data.power / 1000 : data.power;

          // Atualiza lista principal
          setEquipments((prev) =>
            prev.map((eq) => {
              if (eq.id === targetId) {
                return {
                  ...eq,
                  powerKw: realKw ?? eq.powerKw,
                  voltage: data.voltage ?? eq.voltage,
                  current: data.current ?? eq.current,
                  pf: data.power_factor ?? eq.pf,
                };
              }
              return eq;
            })
          );

          // Atualiza o modal aberto instantaneamente
          setSelectedAnalysisEquip((prevModal) => {
            if (prevModal && prevModal.id === targetId) {
              return {
                ...prevModal,
                powerKw: realKw ?? prevModal.powerKw,
                voltage: data.voltage ?? prevModal.voltage,
                current: data.current ?? prevModal.current,
                pf: data.power_factor ?? prevModal.pf,
              };
            }
            return prevModal;
          });

          const timeStr = new Date(data.created_at || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          const newPoint = {
            time: timeStr,
            power: realKw ?? 0,
            pf: data.power_factor ?? 1,
            current: data.current ?? 0,
          };

          setTelemetryHistory((prev) => {
            const currentHistory = prev[targetId] || [];
            const updatedHistory = [...currentHistory, newPoint].slice(-10);
            return { ...prev, [targetId]: updatedHistory };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedAnalysisEquip) return;

    const fetchHistoricalData = async () => {
      try {
        const targetSensorStr = selectedAnalysisEquip.id === 1 ? "ESP32_PZEM_01" : String(selectedAnalysisEquip.id);

        const { data } = await supabase
          .from("measurements")
          .select("*")
          .eq("sensor_id", targetSensorStr)
          .order("created_at", { ascending: true });

        if (data && data.length > 0) {
          const formatted = data.map((item) => ({
            periodLabel: new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            totalEnergyKw: item.power > 50 ? item.power / 1000 : item.power,
            avgPower: item.power > 50 ? item.power / 1000 : item.power,
          }));
          setHistoricalData(formatted);
        } else {
          setHistoricalData(mockCompareData[comparePeriod]);
        }
      } catch (err) {
        setHistoricalData(mockCompareData[comparePeriod]);
      }
    };

    fetchHistoricalData();
  }, [selectedAnalysisEquip, comparePeriod]);

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
      current: ((parseFloat(powerKw) * 1000) / 220).toFixed(1),
      pf: 0.92,
      thd: "3.0%",
      loadType: "Geral",
    };

    setEquipments([...equipments, newEquip]);
    setName("");
    setPowerKw("");
    setDailyHours("");
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
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sensores Inteligentes</h1>
          <p className="text-sm text-slate-500">Monitoramento em tempo real de equipamentos e setores</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSectorModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Novo Setor</span>
          </button>

          <button
            onClick={() => setIsEquipModalOpen(true)}
            className="px-4 py-2.5 bg-[#026aa7] hover:bg-[#025a8e] text-white rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
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
              {totalPower.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="text-sm font-normal text-slate-500">kW</span>
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
              {totalMonthlyConsumption.toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kWh</span>
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
            <BarChart data={sectorData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="sector" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="consumption" fill="#026aa7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Equipamentos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipments.map((item) => {
            const monthlyKw = (item.powerKw * item.dailyHours * 30).toLocaleString("pt-BR");
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
                      <span className="font-semibold text-slate-800">{item.powerKw} kW</span>
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
                    onClick={() => setSelectedAnalysisEquip(item)}
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 space-y-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{selectedAnalysisEquip.name}</h3>
                  <span className="px-2.5 py-0.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-md">
                    ESP32 PZEM-04T
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Setor: <span className="font-semibold">{selectedAnalysisEquip.sector}</span> | Tipo: <span className="font-semibold">{selectedAnalysisEquip.loadType}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedAnalysisEquip(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Gauge className="h-3 w-3 text-sky-500" /> Fator Potência
                </p>
                <p className={`text-lg font-bold mt-1 ${selectedAnalysisEquip.pf < 0.92 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selectedAnalysisEquip.pf}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Tensão / Corrente
                </p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {selectedAnalysisEquip.voltage}V / {selectedAnalysisEquip.current}A
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-purple-500" /> Distorção (THD)
                </p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {selectedAnalysisEquip.thd}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-emerald-500" /> Custo Mensal Est.
                </p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  R$ {((selectedAnalysisEquip.powerKw * selectedAnalysisEquip.dailyHours * 30) * 0.75).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">Curva de Carga em Tempo Real</h4>
              <p className="text-xs text-slate-400 mb-4">Variação instantânea enviada pelo ESP32</p>
              
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory[selectedAnalysisEquip.id] || telemetryHistory[1]}>
                    <defs>
                      <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#026aa7" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#026aa7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="power" name="Potência (kW)" stroke="#026aa7" fillOpacity={1} fill="url(#colorPower)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#026aa7]" />
                    Análise e Comparação de Consumo
                  </h4>
                  <p className="text-xs text-slate-400">Dados acumulados no Supabase</p>
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

              <div className="h-52 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historicalData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="periodLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="totalEnergyKw" name="Consumo Acumulado (kWh)" fill="#026aa7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgPower" name="Média de Potência (kW)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-sky-900">Análise do Perfil Elétrico:</p>
              {selectedAnalysisEquip.pf < 0.92 ? (
                <p className="text-amber-800">
                  ⚠️ <strong>Atenção:</strong> Fator de potência medido ({selectedAnalysisEquip.pf}) está abaixo do limite regulatório de 0,92. É recomendável o dimensionamento de um banco de capacitores ou correção local.
                </p>
              ) : (
                <p className="text-emerald-800">
                  ✅ <strong>Eficiência Elevada:</strong> O equipamento opera dentro da faixa ideal de fator de potência ({selectedAnalysisEquip.pf}), apresentando baixo desperdício por energia reativa.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedAnalysisEquip(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEquipModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-fadeIn">
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
                  className="px-4 py-2 bg-[#026aa7] hover:bg-[#025a8e] text-white rounded-xl text-sm font-medium flex items-center space-x-1.5 transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-fadeIn">
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
                  className="px-4 py-2 bg-[#026aa7] hover:bg-[#025a8e] text-white rounded-xl text-sm font-medium flex items-center space-x-1.5 transition-colors"
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