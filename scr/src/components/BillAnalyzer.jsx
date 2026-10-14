import { useRef, useState } from "react";
import { 
  Sparkles, Upload, FileText, X, Loader2, Download, Send, 
  MessageCircle, AlertTriangle, CheckCircle2, TrendingUp, 
  ChevronDown, ChevronUp, Copy, Check, Zap, DollarSign, Building,
  Lock, Unlock, Eye, EyeOff, KeyRound
} from "lucide-react";
import { openPdf, unlockPdf, pdfToImages, closePdf, PdfPasswordError } from "@/lib/pdfUnlock";

const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));

export default function BillAnalyzer({ isOpen, onClose, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
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
    if (!isPdf(selected)) return;

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

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const callGeminiApi = async (modelName, apiKey, parts) => {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
          },
        }),
      }
    );
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error("Chave VITE_GEMINI_API_KEY não encontrada no ficheiro .env.");
      }

      const promptText = `
        Você é um auditor sênior de faturas de energia elétrica industrial do Grupo A (Tarifa Verde/Azul).
        Análise este documento e retorne EXCLUSIVAMENTE um objeto JSON válido sem formatação markdown extra.
        
        Siga exatamente este esquema:
        {
          "client_name": "Nome da empresa/cliente extraído ou Unidade Consumidora",
          "uc": "Número da UC ou Conta Contrato",
          "reference_month": "MM/AAAA",
          "demand_contracted": 0.0 (kW),
          "demand_measured": 0.0 (kW),
          "demand_surpass": 0.0 (kW),
          "consumption_total": 0.0 (kWh — some ponta e fora de ponta; converta MWh para kWh),
          "total_bill_value": 0.0 (R$),
          "suggested_demand": 0.0 (kW),
          "power_factor": 0.92,
          "insights": [
            {
              "type": "warning | danger | success",
              "title": "Título do diagnóstico",
              "desc": "Descrição detalhada dos custos, multas envolvidas e recomendações técnicas para economia."
            }
          ]
        }
      `;

      let parts;
      if (pdfState === "unlocked" && unlockedDocRef.current) {
        // PDF protegido: envia as páginas já desbloqueadas como imagens + o texto extraído
        const { images, text, totalPages, sentPages } = await pdfToImages(unlockedDocRef.current);
        const note = totalPages > sentPages
          ? `
Observação: a fatura tem ${totalPages} páginas; foram enviadas as ${sentPages} primeiras.`
          : "";
        parts = [
          { text: promptText + note },
          ...images.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })),
          ...(text ? [{ text: `Texto extraído do PDF (use para conferir os números):
${text}` }] : []),
        ];
      } else {
        const base64Data = await fileToBase64(file);
        parts = [
          { text: promptText },
          { inline_data: { mime_type: file.type || "application/pdf", data: base64Data } },
        ];
      }

      let response;

      try {
        response = await callGeminiApi("gemini-3.8-flash", apiKey, parts);
        if (!response.ok) throw new Error(`Status ${response.status}`);
      } catch (primaryErr) {
        response = await callGeminiApi("gemini-3.5-flash", apiKey, parts);
      }

      if (response.status === 429) {
        throw new Error("Limite de requisições atingido. Aguarde 1 minuto e tente novamente.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Erro na comunicação (${response.status})`);
      }

      const data = await response.json();
      const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawJsonText) {
        throw new Error("Não foi possível extrair texto da fatura.");
      }

      const cleanJsonText = rawJsonText.replace(/```json/g, "").replace(/```/g, "").trim();
      setResult(JSON.parse(cleanJsonText));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Falha ao analisar a fatura.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInsight = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatorio_Executivo_${result.uc || "EnergYIQ"}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; background: #fff; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
            .brand { font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .meta-value { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px; }
            .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; border-left: 4px solid #0284c7; padding-left: 10px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .kpi-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; }
            .kpi-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0284c7; margin-top: 6px; }
            .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
            .insight-card { border-radius: 10px; padding: 16px; margin-bottom: 15px; border-left: 5px solid; }
            .danger { background: #fff1f2; border-color: #e11d48; color: #881337; }
            .warning { background: #fffbeb; border-color: #f59e0b; color: #78350f; }
            .success { background: #f0fdf4; border-color: #16a34a; color: #14532d; }
            .insight-header { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
            .insight-body { font-size: 12px; opacity: 0.95; leading-trim: both; }
            .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">EnergYIQ</div>
              <div style="font-size: 12px; color: #64748b;">Relatório Executivo de Auditoria Tarifária</div>
            </div>
            <span class="badge">Análise Gemini AI</span>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Cliente / Razão Social</span>
              <span class="meta-value">${result.client_name || "Não identificado"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Unidade Consumidora (UC)</span>
              <span class="meta-value">${result.uc || "N/A"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Mês de Referência</span>
              <span class="meta-value">${result.reference_month || "Atual"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Demanda Sugerida para Contrato</span>
              <span class="meta-value" style="color: #0284c7;">${result.suggested_demand || result.demand_measured} kW</span>
            </div>
          </div>

          <div class="section-title">Métricas de Consumo e Demanda</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Demanda Medida</div>
              <div class="kpi-val" style="color: ${result.demand_measured > result.demand_contracted ? '#e11d48' : '#0284c7'}">
                ${result.demand_measured} kW
              </div>
              <div class="kpi-sub">Pico registrado</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Demanda Contratada</div>
              <div class="kpi-val" style="color: #334155;">${result.demand_contracted} kW</div>
              <div class="kpi-sub">Limite em contrato</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Consumo Total</div>
              <div class="kpi-val" style="color: #0f172a;">${result.consumption_total}</div>
              <div class="kpi-sub">kWh faturado</div>
            </div>
          </div>

          <div class="section-title">Diagnóstico & Oportunidades de Economia</div>
          ${result.insights?.map(item => `
            <div class="insight-card ${item.type}">
              <div class="insight-header">${item.title}</div>
              <div class="insight-body">${item.desc}</div>
            </div>
          `).join('') || ''}

          <div class="footer">
            Relatório gerado automaticamente por EnergYIQ via Gemini AI • Documento confidencial
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendWhatsApp = () => {
    if (!result) return;
    const text = encodeURIComponent(
      `⚡ *EnergYIQ - Auditoria Tarifária de Energia*\n\n` +
      `🏢 *Cliente:* ${result.client_name || result.uc}\n` +
      `📊 *UC:* ${result.uc} | *Ref:* ${result.reference_month}\n\n` +
      `🔹 *Demanda Medida:* ${result.demand_measured} kW\n` +
      `🔹 *Demanda Contratada:* ${result.demand_contracted} kW\n` +
      `💡 *Demanda Sugerida:* ${result.suggested_demand || result.demand_measured} kW\n\n` +
      `🔍 *Diagnóstico Principal:*\n${result.insights?.[0]?.title}: ${result.insights?.[0]?.desc.slice(0, 150)}...`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleSendEmail = () => {
    if (!result) return;
    const subject = encodeURIComponent(`Relatório Executivo de Energia - ${result.client_name || result.uc}`);
    const body = encodeURIComponent(
      `Prezados,\n\nSegue o resumo da análise inteligente da fatura realizada pelo Gemini AI:\n\n` +
      `- Cliente: ${result.client_name}\n` +
      `- UC: ${result.uc}\n` +
      `- Demanda Medida vs. Contratada: ${result.demand_measured} kW / ${result.demand_contracted} kW\n` +
      `- Recomendação: Adequar demanda contratada para ${result.suggested_demand || result.demand_measured} kW.\n\n` +
      `Atenciosamente,\nEquipe EnergYIQ`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const hasSurpass = result && result.demand_measured > result.demand_contracted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho Interativo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-navy-gradient text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 rounded-xl border border-sky-400/30">
              <Sparkles className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">Auditoria Inteligente de Fatura</h3>
              <p className="text-xs text-sky-200/80">Plataforma EnergYIQ • IA Gemini</p>
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

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!result ? (
            /* Estado de Upload */
            <div className="space-y-5">
              <label 
                htmlFor="bill-file-input" 
                className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-sky-200 hover:border-sky-500 rounded-3xl hover:bg-sky-50/40 cursor-pointer text-center bg-slate-50/50 transition-all group"
              >
                <div className="p-4 bg-sky-100 rounded-2xl text-sky-600 group-hover:scale-110 transition-transform mb-3">
                  <Upload className="h-8 w-8" />
                </div>
                <span className="font-bold text-slate-800 text-base">Arraste ou selecione a fatura (PDF ou Imagem)</span>
                <span className="text-xs text-slate-400 mt-1 max-w-xs">A IA analisará a fatura do Grupo A extraindo demandas, multas e oportunidades do Mercado Livre</span>
                
                {file && (
                  <div className="mt-4 max-w-full px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-md shadow-sky-500/20">
                    {pdfState === "checking" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> :
                     pdfState === "locked" ? <Lock className="h-4 w-4 shrink-0" /> :
                     pdfState === "unlocked" ? <Unlock className="h-4 w-4 shrink-0" /> :
                     <FileText className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
                <input id="bill-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} className="hidden" />
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
                  <span>PDF desbloqueado. As páginas serão enviadas à IA como imagens, sem a senha.</span>
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
                disabled={!file || loading || pdfState === "checking" || pdfState === "locked"}
                className="w-full py-4 bg-brand-gradient hover:brightness-110 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/25 transition-all cursor-pointer text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processando e auditando fatura com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Executar Análise de Energia</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Dashboard de Resultados */
            <div className="space-y-6">
              
              {/* Barra de Identificação do Cliente */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-sm">
                    <Building className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{result.client_name || "Unidade Consumidora"}</h4>
                    <p className="text-xs text-slate-500">UC: <span className="font-semibold text-slate-700">{result.uc || "N/A"}</span> • Ref: <span className="font-semibold text-slate-700">{result.reference_month || "N/A"}</span></p>
                  </div>
                </div>

                {hasSurpass && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Ultrapassagem Detectada</span>
                  </span>
                )}
              </div>

              {/* Seletor de Abas Navegáveis */}
              <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`pb-3 transition-all relative ${
                    activeTab === "overview" 
                      ? "text-sky-600 border-b-2 border-sky-600" 
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Visão Geral & KPIs
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className={`pb-3 transition-all relative flex items-center space-x-2 ${
                    activeTab === "insights" 
                      ? "text-sky-600 border-b-2 border-sky-600" 
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span>Diagnóstico Detalhado</span>
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded-full font-bold">
                    {result.insights?.length || 0}
                  </span>
                </button>
              </div>

              {/* Aba 1: Visão Geral */}
              {activeTab === "overview" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Card 1 */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Demanda Medida</span>
                        <Zap className="h-4 w-4 text-amber-500" />
                      </div>
                      <p className={`text-2xl font-extrabold ${hasSurpass ? "text-rose-600" : "text-slate-800"}`}>
                        {result.demand_measured} <span className="text-xs font-semibold text-slate-500">kW</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Pico máximo registrado</p>
                    </div>

                    {/* Card 2 */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Contratada</span>
                        <TrendingUp className="h-4 w-4 text-sky-500" />
                      </div>
                      <p className="text-2xl font-extrabold text-slate-800">
                        {result.demand_contracted} <span className="text-xs font-semibold text-slate-500">kW</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Capacidade em contrato</p>
                    </div>

                    {/* Card 3 */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Consumo Total</span>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="text-2xl font-extrabold text-slate-800">
                        {result.consumption_total} <span className="text-xs font-semibold text-slate-500">kWh</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Total do período faturado</p>
                    </div>

                  </div>

                  {/* Recomendação de Contrato */}
                  {result.suggested_demand && (
                    <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-sky-900 uppercase">Sugestão de Readequação de Contrato</p>
                        <p className="text-xs text-sky-700">Ajuste o contrato de demanda para evitar multas de ultrapassagem recorrentes.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-sky-600 block font-semibold">Nova Demanda Recomendada</span>
                        <span className="text-xl font-extrabold text-sky-900">{result.suggested_demand} kW</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aba 2: Diagnóstico Interativo (Accordion) */}
              {activeTab === "insights" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {result.insights?.map((insight, idx) => {
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
                              <span>{copiedIndex === idx ? "Copiado!" : "Copiar Diagnóstico"}</span>
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

        {/* Rodapé e Ações */}
        {result && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadPDF}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-slate-600" />
                <span>PDF Executivo</span>
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
                <span>Email</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={resetFile}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Nova Fatura
              </button>

              <button
                onClick={() => {
                  if (onAnalysisComplete) onAnalysisComplete(result);
                  handleClose();
                }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                Aplicar ao Painel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}