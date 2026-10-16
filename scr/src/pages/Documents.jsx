import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSignature, Building2, PenLine, Printer, ListChecks, Trash2, Info } from "lucide-react";
import { useCurrentBill, mesBR } from "../lib/currentBill";
import { simularContratoDemanda, custoDemandaMes, TOLERANCIA_ULTRAPASSAGEM } from "../lib/billXray";
import { parseNumberBR } from "../lib/billParsing";
import InfoTip from "../components/ui/InfoTip";

// Pedido de alteração da demanda contratada, em passos para o cliente.
// Até a Etapa 2 (banco de dados), os pedidos ficam salvos só neste navegador.

const STORAGE_KEY = "energyiq-pedidos-demanda";
const STATUS = ["Rascunho", "Enviado à Enel", "Em análise", "Aprovado", "Recusado"];
const STATUS_COR = {
  Rascunho: "bg-slate-100 text-slate-600 border-slate-200",
  "Enviado à Enel": "bg-sky-50 text-sky-700 border-sky-200",
  "Em análise": "bg-amber-50 text-amber-700 border-amber-200",
  Aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Recusado: "bg-rose-50 text-rose-700 border-rose-200",
};

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v, d = 2) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inputCls =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500";

/** Números do contrato de demanda a partir do histórico da fatura em uso. */
function dadosDoContrato(ref) {
  const tarifaDemanda = ref.itens.find((i) => i.componente === "demanda").precoComTributos;
  const medidas = ref.historico.map((h) => h.demandaForaPontaKw);
  const meses = medidas.length;
  return {
    tarifaDemanda,
    sim: simularContratoDemanda(ref.historico, ref.demandaContratadaKw, tarifaDemanda),
    medidas,
    minMed: Math.min(...medidas),
    maxMed: Math.max(...medidas),
    meses,
    periodo: `${mesBR(ref.historico[0].mes)} a ${mesBR(ref.historico[meses - 1].mes)}`,
  };
}

function justificativaPadrao(ref, { medidas, minMed, maxMed, meses, periodo }, novoKw) {
  const acima = medidas.filter((m) => m > ref.demandaContratadaKw * TOLERANCIA_ULTRAPASSAGEM).length;
  return (
    `No período de ${periodo}, a demanda medida fora de ponta da unidade variou entre ${num(minMed)} kW e ${num(maxMed)} kW, ` +
    (acima > 0
      ? `acima da demanda contratada de ${num(ref.demandaContratadaKw, 0)} kW em ${acima} de ${meses} meses, com cobrança de ultrapassagem. `
      : `com demanda contratada de ${num(ref.demandaContratadaKw, 0)} kW. `) +
    `Para adequar o contrato ao perfil real de consumo da unidade, solicitamos a alteração da demanda contratada para ${num(novoKw, 0)} kW, ` +
    `na modalidade tarifária ${ref.modalidade}.`
  );
}

function lerPedidos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function Documents() {
  const [params] = useSearchParams();
  const { fatura: ref } = useCurrentBill();
  const d = useMemo(() => dadosDoContrato(ref), [ref]);
  const { tarifaDemanda, sim, medidas, minMed, maxMed, meses } = d;
  const inicial = parseNumberBR(params.get("contrato"), null) || sim.otimo.contratoKw;

  const [novoKw, setNovoKw] = useState(String(inicial));
  const [form, setForm] = useState({ razaoSocial: "", cnpj: "", instalacao: "", endereco: "", responsavel: "", cargo: "", contato: "" });
  const [justificativa, setJustificativa] = useState(() => justificativaPadrao(ref, d, inicial));
  const [justificativaEditada, setJustificativaEditada] = useState(false);
  const [erro, setErro] = useState(null);
  const [pedidos, setPedidos] = useState(lerPedidos);

  const novo = parseNumberBR(novoKw, null);
  const custoAtual = useMemo(() => medidas.reduce((s, m) => s + custoDemandaMes(ref.demandaContratadaKw, m, tarifaDemanda), 0), [ref, medidas, tarifaDemanda]);
  const custoNovo = novo > 0 ? medidas.reduce((s, m) => s + custoDemandaMes(novo, m, tarifaDemanda), 0) : null;
  const economiaMes = custoNovo != null ? (custoAtual - custoNovo) / meses : null;

  // Justificativa acompanha o valor pedido, até a pessoa editá-la
  useEffect(() => {
    if (!justificativaEditada && novo > 0) setJustificativa(justificativaPadrao(ref, d, novo));
  }, [ref, d, novo, justificativaEditada]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos));
    } catch {
      /* armazenamento indisponível: os pedidos só não ficam salvos */
    }
  }, [pedidos]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validar = () => {
    if (!(novo > 0)) return "Informe a nova demanda em kW.";
    if (!form.razaoSocial.trim()) return "Informe a razão social da empresa.";
    if (!form.instalacao.trim()) return "Informe o número da instalação (está no topo da fatura).";
    if (!form.responsavel.trim()) return "Informe o nome de quem assina o pedido.";
    return null;
  };

  const gerarCarta = () => {
    const e = validar();
    setErro(e);
    if (e) return;
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const w = window.open("", "_blank");
    if (!w) return setErro("O navegador bloqueou a janela da carta. Permita pop-ups para este site e tente de novo.");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Solicitação de alteração de demanda — ${esc(form.razaoSocial)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:720px;margin:48px auto;padding:0 24px;line-height:1.6;font-size:15px}
  h1{font-size:18px;text-transform:uppercase;letter-spacing:.04em;margin:32px 0 16px}
  table{border-collapse:collapse;width:100%;margin:16px 0}td{border:1px solid #999;padding:6px 10px;vertical-align:top}td:first-child{width:42%;background:#f4f4f4}
  .ass{margin-top:64px}.linha{border-top:1px solid #111;width:320px;padding-top:4px}
  .nota{font-size:12px;color:#555;margin-top:32px}
  @media print{.nota{display:none}}
</style></head><body>
<p>${esc(form.endereco ? form.endereco.split(",").slice(-1)[0].trim() || "" : "")}${form.endereco ? ", " : ""}${esc(hoje)}</p>
<p>À<br>${esc(ref.distribuidora === "Enel CE" ? "Enel Distribuição Ceará" : ref.distribuidora)}<br>Atendimento Corporativo</p>
<h1>Solicitação de alteração de demanda contratada</h1>
<p>A empresa <strong>${esc(form.razaoSocial)}</strong>${form.cnpj ? `, inscrita no CNPJ sob o nº ${esc(form.cnpj)}` : ""}, titular da unidade consumidora abaixo, solicita a alteração da demanda contratada conforme os dados a seguir.</p>
<table>
<tr><td>Nº da instalação / unidade consumidora</td><td>${esc(form.instalacao)}</td></tr>
${form.endereco ? `<tr><td>Endereço da unidade</td><td>${esc(form.endereco)}</td></tr>` : ""}
<tr><td>Subgrupo / modalidade tarifária</td><td>${esc(ref.subgrupo)} / ${esc(ref.modalidade)}</td></tr>
<tr><td>Demanda contratada atual</td><td>${esc(num(ref.demandaContratadaKw, 0))} kW</td></tr>
<tr><td>Demanda contratada solicitada</td><td><strong>${esc(num(novo, 0))} kW</strong></td></tr>
</table>
<p><strong>Justificativa.</strong> ${esc(justificativa)}</p>
<p>Ficamos à disposição para os esclarecimentos necessários${form.contato ? ` pelo contato ${esc(form.contato)}` : ""}.</p>
<div class="ass"><div class="linha">${esc(form.responsavel)}${form.cargo ? `<br>${esc(form.cargo)}` : ""}<br>${esc(form.razaoSocial)}</div></div>
<p class="nota">Documento gerado pelo EnergyIQ. Confira com a Enel o formulário e as condições vigentes antes de enviar. Use Ctrl+P para imprimir ou salvar em PDF.</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    w.document.close();
  };

  const salvar = () => {
    const e = validar();
    setErro(e);
    if (e) return;
    setPedidos((p) => [
      { id: Date.now(), criadoEm: new Date().toISOString(), atualKw: ref.demandaContratadaKw, novoKw: novo, instalacao: form.instalacao, empresa: form.razaoSocial, status: "Rascunho" },
      ...p,
    ]);
  };

  return (
    <div className="lg:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pedir novo contrato de demanda</h1>
        <p className="text-sm text-slate-500">Em 4 passos: o EnergyIQ prepara a carta para a Enel com os dados da sua fatura.</p>
      </div>

      {/* 1. O que pedir */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileSignature className="h-4 w-4 text-sky-500" /> 1. O que vamos pedir
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contrato hoje</p>
            <p className="font-heading text-xl font-bold text-slate-900">{num(ref.demandaContratadaKw, 0)} kW</p>
            <p className="text-xs text-slate-500">Você usa entre {num(minMed, 0)} e {num(maxMed, 0)} kW</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
            <label htmlFor="novo-kw" className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
              Novo contrato (kW)
            </label>
            <input id="novo-kw" inputMode="decimal" value={novoKw} onChange={(e) => setNovoKw(e.target.value)} className={`${inputCls} mt-1 font-semibold`} />
            <p className="text-xs text-slate-500 mt-1">Sugerido pelo seu histórico: {num(sim.otimo.contratoKw, 0)} kW</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Economia estimada</p>
            <p className="font-heading text-xl font-bold text-slate-900">{economiaMes != null ? `${brl(economiaMes)}/mês` : "—"}</p>
            <p className="text-xs text-slate-500">Média dos {meses} meses do histórico</p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Paga-se sempre o maior entre a demanda medida e a contratada; acima de 105% da contratada, o excedente é cobrado em dobro.
            Um contrato um pouco abaixo do pico pode sair mais barato que contratar o pico.
          </span>
        </p>
      </section>

      {/* 2. Dados */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Building2 className="h-4 w-4 text-sky-500" /> 2. Dados da empresa e de quem assina
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["razaoSocial", "Razão social *", "Como está na fatura"],
            ["cnpj", "CNPJ", "00.000.000/0000-00"],
            ["instalacao", "Nº da instalação *", "Topo da fatura: “Instalação / unid. consumidora”"],
            ["endereco", "Endereço da unidade", "Rua, número, cidade"],
            ["responsavel", "Nome de quem assina *", "Representante legal da empresa"],
            ["cargo", "Cargo", "Ex.: diretor industrial"],
            ["contato", "Telefone ou e-mail para contato", ""],
          ].map(([k, label, ph]) => (
            <div key={k}>
              <label htmlFor={`f-${k}`} className="block text-xs font-medium text-slate-700 mb-1">
                {label}
                {k === "instalacao" && (
                  <InfoTip>É o número que identifica o ponto de entrega da energia. Aparece no topo da fatura da Enel.</InfoTip>
                )}
              </label>
              <input id={`f-${k}`} value={form[k]} onChange={set(k)} placeholder={ph} className={inputCls} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Estes dados ficam só neste navegador e entram apenas na carta. A Enel pode pedir documentos do representante legal no envio.
        </p>
      </section>

      {/* 3. Justificativa */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <PenLine className="h-4 w-4 text-sky-500" /> 3. Justificativa
        </h2>
        <p className="text-xs text-slate-500">Escrita a partir do seu histórico de {meses} meses. Pode editar à vontade.</p>
        <textarea
          id="justificativa"
          rows={5}
          value={justificativa}
          onChange={(e) => {
            setJustificativa(e.target.value);
            setJustificativaEditada(true);
          }}
          className={`${inputCls} leading-relaxed`}
        />
        {justificativaEditada && (
          <button
            type="button"
            onClick={() => {
              setJustificativaEditada(false);
              setJustificativa(justificativaPadrao(ref, d, novo || sim.otimo.contratoKw));
            }}
            className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
          >
            Voltar ao texto sugerido
          </button>
        )}
      </section>

      {/* 4. Gerar */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Printer className="h-4 w-4 text-sky-500" /> 4. Gerar a carta
        </h2>
        {erro && <p role="alert" className="text-sm font-medium text-rose-600">{erro}</p>}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={gerarCarta} className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold cursor-pointer">
            Gerar carta (imprimir ou salvar em PDF)
          </button>
          <button type="button" onClick={salvar} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer">
            Salvar para acompanhar
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Antes de enviar, confira com a Enel o formulário e as condições vigentes para alteração de demanda (REN ANEEL 1.000/2021), como
          prazos de antecedência e de permanência do contrato.
        </p>
      </section>

      {/* Acompanhamento */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ListChecks className="h-4 w-4 text-sky-500" /> Acompanhamento dos pedidos
        </h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum pedido salvo ainda. Gere a carta e clique em “Salvar para acompanhar”.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pedidos.map((p) => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {p.empresa} · instalação {p.instalacao}
                  </p>
                  <p className="text-xs text-slate-500">
                    {num(p.atualKw, 0)} kW → {num(p.novoKw, 0)} kW · criado em {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`st-${p.id}`}>Situação do pedido</label>
                <select
                  id={`st-${p.id}`}
                  value={p.status}
                  onChange={(e) => setPedidos((all) => all.map((x) => (x.id === p.id ? { ...x, status: e.target.value } : x)))}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${STATUS_COR[p.status]}`}
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Excluir pedido"
                  onClick={() => setPedidos((all) => all.filter((x) => x.id !== p.id))}
                  className="self-start sm:self-auto p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400">Por enquanto os pedidos ficam salvos só neste navegador.</p>
      </section>
    </div>
  );
}
