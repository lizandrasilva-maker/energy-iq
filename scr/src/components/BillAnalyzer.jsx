import { useRef, useState } from "react";
import {
  ScanLine, Upload, FileText, X, Loader2, Download, Send,
  MessageCircle, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronDown, ChevronUp, Copy, Check, Zap, Receipt, ShieldCheck,
  Lock, Unlock, Eye, EyeOff, KeyRound
} from "lucide-react";
import { openPdf, unlockPdf, pdfTextPages, closePdf, PdfPasswordError } from "@/lib/pdfUnlock";
import { linesFromPages, parseEnelBill } from "@/lib/enelBillParser";
import { billXray, TOLERANCIA_ULTRAPASSAGEM } from "@/lib/billXray";
import { diagnostico } from "@/lib/savings";
import { setCurrentBill, mesBR } from "@/lib/currentBill";
import BillXrayCard from "./BillXrayCard";

const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, d = 0) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Leitura da fatura no próprio navegador, por regras (Enel CE, Grupo A).
 * O arquivo não é enviado a nenhum servidor; nada de nome ou documento é lido.
 */
export default function BillAnalyzer({ isOpen, onClose, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { fatura, avisos, faltando, insights }
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'insights'
  const [expandedInsight, setExpandedInsight] = useState(0); // índice do accordion aberto
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Proteção por senha do PDF
  // pdfState: null (imagem/sem arquivo) | "checking" | "open" (sem senha) | "locked" | "unlocked"
  const [pdfState, setPdfState] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(null);
  const unlockedDocRef = useRef(null); // documento pdf.js já aberto com a senha

  if (!isOpen) return null;

  const releaseUnlockedDoc = () => {
    closePdf(unlockedDocRef.current);
    unlockedDocRef.current = null;
  };

  const resetFile = () => {
    releaseUnlockedDoc();
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    setPdfState(null);
    setPasswordInput("");
    setUnlockError(null);
    setActiveTab("overview");
    setExpandedInsight(0);
  };

  const handleClose = () => {
    resetFile();
    onClose();
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!selected) return;

    resetFile();
    setFile(selected);
    if (!isPdf(selected)) {
      setErrorMsg(
        "A leitura automática funciona com o PDF da fatura (o arquivo baixado no site ou app da Enel). Foto ou fatura digitalizada ainda não é lida."
      );
      return;
    }

    // Descobre já na seleção se o PDF pede senha
    setPdfState("checking");
    try {
      const doc = await openPdf(selected);
      closePdf(doc);
      setPdfState("open");
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setPdfState("locked");
      } else {
        setPdfState(null);
        setErrorMsg(err.message);
      }
    }
  };

  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!file || !passwordInput.trim()) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const { doc } = await unlockPdf(file, passwordInput);
      releaseUnlockedDoc();
      unlockedDocRef.current = doc;
      setPdfState("unlocked");
      setPasswordInput(""); // não mantém a senha na tela
    } catch (err) {
      setUnlockError(
        err instanceof PdfPasswordError
          ? "Senha incorreta. Confira os dígitos ou tente o CPF/CNPJ completo do titular."
          : err.message
      );
    } finally {
      setUnlocking(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !isPdf(file)) return;
    setLoading(true);
    setErrorMsg(null);

    const doc = pdfState === "unlocked" && unlockedDocRef.current ? unlockedDocRef.current : await openPdf(file).catch((err) => err);
    try {
      if (doc instanceof Error) throw doc;
      const parsed = parseEnelBill(linesFromPages(await pdfTextPages(doc)));
      if (!parsed.ok) throw new Error(parsed.motivo);
      setResult({
        fatura: parsed.fatura,
        avisos: parsed.avisos,
        faltando: parsed.faltando,
        insights: parsed.faltando.length ? [] : diagnostico(parsed.fatura),
      });
    } catch (err) {
      setErrorMsg(err.message || "Não foi possível ler a fatura.");
    } finally {
      if (doc !== unlockedDocRef.current && !(doc instanceof Error)) closePdf(doc);
      setLoading(false);
    }
  };

  const handleCopyInsight = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const f = result?.fatura;
  const x = f ? billXray(f) : null;
  const ultrapassou = f && f.medicao.demandaForaPontaKw > f.demandaContratadaKw * TOLERANCIA_ULTRAPASSAGEM;
  const consumoKwh = f ? (f.medicao.energiaForaPontaKwh || 0) + (f.medicao.energiaPontaKwh || 0) : 0;
  const podeAplicar = result && result.faltando.length === 0;
  const resumo = f ? `${f.subgrupo} ${f.modalidade} · ${f.distribuidora} · referência ${mesBR(f.referencia)}` : "";

  const handleDownloadPDF = () => {
    if (!f) return;
    const w = window.open("", "_blank");
    if (!w) return setErrorMsg("O navegador bloqueou a janela do relatório. Permita pop-ups para este site.");
    const linhas = x.componentes
      .map((c) => `<tr><td>${esc(c.label)}${c.evitavel ? " <b>(evitável)</b>" : ""}</td><td class="r">${esc(brl(c.valor))}</td><td class="r">${esc(num(c.pct * 100, 1))}%</td></tr>`)
      .join("");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>EnergyIQ — fatura ${esc(mesBR(f.referencia))}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;padding:40px;color:#0f172a;line-height:1.5;max-width:820px;margin:auto}
  .head{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #1a8cff;padding-bottom:14px;margin-bottom:24px}
  .brand{font-size:22px;font-weight:800;color:#0b1d3a}.sub{font-size:12px;color:#64748b}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#334155;margin:24px 0 10px;border-left:4px solid #1a8cff;padding-left:8px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .kpi{border:1px solid #cbd5e1;border-radius:10px;padding:12px}.kpi b{display:block;font-size:18px}.kpi span{font-size:11px;color:#64748b;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.r{text-align:right}
  .ins{border-left:4px solid;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px}
  .danger{background:#fff1f2;border-color:#e11d48}.warning{background:#fffbeb;border-color:#f59e0b}.success{background:#f0fdf4;border-color:#16a34a}
  .ins b{display:block;font-size:13px;margin-bottom:2px}
  .foot{margin-top:32px;font-size:11px;color:#94a3b8;text-align:center}
</style></head><body>
<div class="head"><div><div class="brand">EnergyIQ</div><div class="sub">Raio-x da fatura de energia</div></div><div class="sub">${esc(resumo)}</div></div>
<div class="kpis">
  <div class="kpi"><span>Demanda contratada</span><b>${esc(num(f.demandaContratadaKw, 2))} kW</b></div>
  <div class="kpi"><span>Demanda medida</span><b style="color:${ultrapassou ? "#e11d48" : "#0f172a"}">${esc(num(f.medicao.demandaForaPontaKw, 2))} kW</b></div>
  <div class="kpi"><span>Consumo</span><b>${esc(num(consumoKwh))} kWh</b></div>
  <div class="kpi"><span>Total a pagar</span><b>${esc(f.total != null ? brl(f.total) : "—")}</b></div>
</div>
<h2>Quanto cada componente pesa</h2>
<table>${linhas}<tr><td><b>Conta de energia</b></td><td class="r"><b>${esc(brl(x.soma))}</b></td><td class="r"></td></tr></table>
<h2>Diagnóstico</h2>
${result.insights.map((i) => `<div class="ins ${esc(i.type)}"><b>${esc(i.title)}</b>${esc(i.desc)}</div>`).join("")}
<div class="foot">Gerado pelo EnergyIQ com regras fixas (sem IA) a partir do PDF da fatura. ${x.conferido ? "Itens conferidos com o subtotal impresso." : ""}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    w.document.close();
  };

  const textoResumo = () =>
    `⚡ EnergyIQ — raio-x da fatura (${resumo})\n\n` +
    `Demanda contratada: ${num(f.demandaContratadaKw, 2)} kW\n` +
    `Demanda medida: ${num(f.medicao.demandaForaPontaKw, 2)} kW\n` +
    `Conta de energia: ${brl(x.soma)}\n\n` +
    result.insights.map((i) => `• ${i.title}`).join("\n");

  const handleSendWhatsApp = () => {
    if (!f) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textoResumo())}`, "_blank");
  };

  const handleSendEmail = () => {
    if (!f) return;
    const subject = encodeURIComponent(`Raio-x da fatura de energia — ${mesBR(f.referencia)}`);
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(textoResumo())}`;
  };

  const handleApply = () => {
    if (!podeAplicar) return;
    setCurrentBill(f);
    onAnalysisComplete?.(f);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-navy-gradient text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 rounded-xl border border-sky-400/30">
              <ScanLine className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">Raio-x da fatura</h3>
              <p className="text-xs text-sky-200/80">Leitura no seu navegador · Enel CE, Grupo A</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!result ? (
            /* Envio */
            <div className="space-y-5">
              <label
                htmlFor="bill-file-input"
                className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-sky-200 hover:border-sky-500 rounded-3xl hover:bg-sky-50/40 cursor-pointer text-center bg-slate-50/50 transition-all group"
              >
                <div className="p-4 bg-sky-100 rounded-2xl text-sky-600 group-hover:scale-110 transition-transform mb-3">
                  <Upload className="h-8 w-8" />
                </div>
                <span className="font-bold text-slate-800 text-base">Selecione o PDF da fatura</span>
                <span className="text-xs text-slate-500 mt-1 max-w-sm">
                  Fatura da Enel Ceará do Grupo A (A4, Verde ou Azul), como baixada no site ou app da Enel. Pode ter senha.
                </span>

                {file && (
                  <div className="mt-4 max-w-full px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-md shadow-sky-500/20">
                    {pdfState === "checking" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> :
                     pdfState === "locked" ? <Lock className="h-4 w-4 shrink-0" /> :
                     pdfState === "unlocked" ? <Unlock className="h-4 w-4 shrink-0" /> :
                     <FileText className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
                <input id="bill-file-input" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} className="hidden" />
              </label>

              {/* PDF protegido por senha */}
              {pdfState === "locked" && (
                <form onSubmit={handleUnlock} className="p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Esta fatura está protegida por senha</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        As distribuidoras costumam usar os <strong>5 primeiros dígitos do CPF ou CNPJ</strong> do titular.
                        Se preferir, digite o documento completo: testamos as combinações mais comuns.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => { setPasswordInput(e.target.value); setUnlockError(null); }}
                        placeholder="Senha ou CPF/CNPJ do titular"
                        autoComplete="off"
                        autoFocus
                        className={`w-full pl-9 pr-10 py-2.5 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                          unlockError ? "border-rose-300 focus:ring-rose-500/20" : "border-slate-200 focus:ring-sky-500/20 focus:border-sky-500"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!passwordInput.trim() || unlocking}
                      className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                    >
                      {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                      <span>{unlocking ? "Testando..." : "Desbloquear"}</span>
                    </button>
                  </div>

                  {unlockError && (
                    <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {unlockError}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    🔒 A senha é usada só no seu navegador para abrir o arquivo. Ela não é enviada nem salva.
                  </p>
                </form>
              )}

              {pdfState === "unlocked" && (
                <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>PDF desbloqueado. Agora é só ler a fatura.</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || !isPdf(file) || loading || pdfState === "checking" || pdfState === "locked"}
                className="w-full py-4 bg-brand-gradient hover:brightness-110 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/25 transition-all cursor-pointer text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Lendo a fatura...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="h-5 w-5" />
                    <span>Ler fatura</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-px text-emerald-600" />
                A fatura é lida aqui, no seu navegador: o arquivo não é enviado a nenhum servidor. Só os números da conta são usados;
                nome, CPF/CNPJ e endereço não são lidos.
              </p>
            </div>
          ) : (
            /* Resultado */
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <Receipt className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Fatura de {mesBR(f.referencia)}</h4>
                    <p className="text-xs text-slate-500">{f.subgrupo} {f.modalidade} · {f.distribuidora}{f.total != null && <> · total a pagar <span className="font-semibold text-slate-700">{brl(f.total)}</span></>}</p>
                  </div>
                </div>

                {ultrapassou && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Ultrapassagem de demanda</span>
                  </span>
                )}
              </div>

              {result.faltando.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>
                    Não consegui ler: {result.faltando.join(", ")}. A fatura não pode ser aplicada ao painel. Envie o PDF original da
                    Enel (não digitalizado) ou fale com a equipe EnergyIQ.
                  </span>
                </div>
              )}
              {result.avisos.length > 0 && (
                <ul className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl space-y-1 list-disc pl-8">
                  {result.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}

              {/* Abas */}
              <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`pb-3 transition-all relative ${
                    activeTab === "overview"
                      ? "text-sky-600 border-b-2 border-sky-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Visão geral
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className={`pb-3 transition-all relative flex items-center space-x-2 ${
                    activeTab === "insights"
                      ? "text-sky-600 border-b-2 border-sky-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span>Diagnóstico</span>
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded-full font-bold">
                    {result.insights.length}
                  </span>
                </button>
              </div>

              {activeTab === "overview" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Demanda medida</span>
                        <Zap className="h-4 w-4 text-amber-500" />
                      </div>
                      <p className={`text-2xl font-extrabold ${ultrapassou ? "text-rose-600" : "text-slate-800"}`}>
                        {num(f.medicao.demandaForaPontaKw, 2)} <span className="text-xs font-semibold text-slate-500">kW</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Maior valor do mês (fora de ponta)</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Contratada</span>
                        <TrendingUp className="h-4 w-4 text-sky-500" />
                      </div>
                      <p className="text-2xl font-extrabold text-slate-800">
                        {num(f.demandaContratadaKw, 2)} <span className="text-xs font-semibold text-slate-500">kW</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Limite do contrato com a Enel</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Consumo</span>
                        <Receipt className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="text-2xl font-extrabold text-slate-800">
                        {num(consumoKwh)} <span className="text-xs font-semibold text-slate-500">kWh</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Ponta + fora de ponta</p>
                    </div>
                  </div>

                  <BillXrayCard fatura={f} />
                </div>
              )}

              {activeTab === "insights" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {result.insights.length === 0 && (
                    <p className="text-sm text-slate-500">Sem diagnóstico: a leitura ficou incompleta.</p>
                  )}
                  {result.insights.map((insight, idx) => {
                    const isExpanded = expandedInsight === idx;
                    return (
                      <div
                        key={idx}
                        className={`border rounded-2xl overflow-hidden transition-all ${
                          insight.type === "danger" ? "border-rose-200 bg-rose-50/30" :
                          insight.type === "warning" ? "border-amber-200 bg-amber-50/30" :
                          "border-emerald-200 bg-emerald-50/30"
                        }`}
                      >
                        <button
                          onClick={() => setExpandedInsight(isExpanded ? null : idx)}
                          className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-black/5 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {insight.type === "danger" ? <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" /> :
                             insight.type === "warning" ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" /> :
                             <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                            <span className="font-bold text-sm text-slate-800">{insight.title}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-black/5 text-xs text-slate-700 space-y-3">
                            <p className="leading-relaxed">{insight.desc}</p>
                            <button
                              onClick={() => handleCopyInsight(`${insight.title}: ${insight.desc}`, idx)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 font-semibold transition-all shadow-sm cursor-pointer"
                            >
                              {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>{copiedIndex === idx ? "Copiado!" : "Copiar"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé e ações */}
        {result && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-slate-600" />
                <span>Relatório</span>
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleSendEmail}
                className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>E-mail</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={resetFile}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Outra fatura
              </button>

              <button
                onClick={handleApply}
                disabled={!podeAplicar}
                title={podeAplicar ? "Todas as telas passam a usar esta fatura" : "Leitura incompleta"}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar ao painel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
