import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, FileSignature, Zap, Store, Sun, ArrowRight, Info } from "lucide-react";
import { useCurrentBill, mesBR } from "../lib/currentBill";
import { partesDaConta, ajusteDemanda, correcaoFP, mercadoLivre, solar, semObra } from "../lib/savings";
import { parseNumberBR } from "../lib/billParsing";
import { useChartTheme } from "../components/charts/ChartKit";
import InfoTip from "../components/ui/InfoTip";

const brl = (v, d = 0) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v, d = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
const pct = (v) => `${num(v * 100, 1)}%`;

const inputCls =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500";

/** Cascata horizontal: conta de hoje, o que cada ajuste tira e a conta depois. */
function ContaAntesDepois({ total, mesRef, passos, cores }) {
  const ativos = passos.filter((p) => p.valor > 0.5);
  const depois = total - ativos.reduce((t, p) => t + p.valor, 0);
  let topo = total;
  const linhas = [
    { label: `Conta de energia de ${mesRef}`, de: 0, ate: total, cor: cores.conta, texto: brl(total) },
    ...ativos.map((p) => {
      const l = { label: p.label, de: topo - p.valor, ate: topo, cor: cores.economia, texto: `− ${brl(p.valor)}`, economia: true };
      topo -= p.valor;
      return l;
    }),
    { label: "Com os ajustes (estimativa)", de: 0, ate: depois, cor: cores.conta, texto: brl(depois), final: true },
  ];
  return (
    <ul className="mt-4 space-y-2.5" aria-label="Conta hoje e depois dos ajustes sem obra">
      {linhas.map((l) => (
        <li key={l.label} className="grid grid-cols-1 sm:grid-cols-[minmax(0,15rem)_1fr_auto] items-center gap-x-3 gap-y-1">
          <span className={`text-sm ${l.final ? "font-bold text-slate-900" : "text-slate-700"}`}>{l.label}</span>
          <span className="relative h-5 rounded-md overflow-hidden" style={{ background: cores.trilho }}>
            <span
              className="absolute inset-y-0 rounded-md"
              style={{
                left: `${(l.de / total) * 100}%`,
                width: `${Math.max(1, ((l.ate - l.de) / total) * 100)}%`,
                background: l.cor,
                opacity: l.final ? 0.7 : 1,
              }}
            />
          </span>
          <span className={`text-sm tabular-nums text-right ${l.economia ? "font-bold text-emerald-700" : "font-semibold text-slate-900"}`}>
            {l.texto}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SolutionCard({ rank, icon: Icon, title, saving, savingNote, investment, children, cta }) {
  return (
    <article className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 min-w-0">
      <header className="flex items-start gap-3">
        <span className="shrink-0 h-8 w-8 rounded-xl bg-sky-50 text-sky-600 grid place-items-center font-heading font-bold text-sm">{rank}</span>
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon className="h-4 w-4 text-sky-500 shrink-0" /> {title}
          </h3>
          <p className="text-xs text-slate-500">Investimento: {investment}</p>
        </div>
      </header>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Economia estimada</p>
        <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums">{saving}</p>
        {savingNote && <p className="text-xs text-slate-500">{savingNote}</p>}
      </div>
      <div className="text-sm text-slate-600 space-y-3">{children}</div>
      {cta && <div className="mt-auto pt-1">{cta}</div>}
    </article>
  );
}

export default function Savings() {
  const chart = useChartTheme();
  const { fatura: ref, isReference } = useCurrentBill();
  const mesRef = mesBR(ref.referencia);
  const partes = partesDaConta(ref);
  const demanda = ajusteDemanda(ref);
  const fp = correcaoFP(ref);
  const totalSemObra = semObra(ref);

  // Premissas que dependem de fornecedor: o cliente informa
  const [precoML, setPrecoML] = useState("");
  const [custosML, setCustosML] = useState("");
  const [cobertura, setCobertura] = useState(0.5);
  const [custoKwp, setCustoKwp] = useState("");
  const [hsp, setHsp] = useState("5,5");

  const ml = useMemo(
    () => mercadoLivre(ref, { precoMWh: parseNumberBR(precoML, null), custosFixosMes: parseNumberBR(custosML, 0) }),
    [ref, precoML, custosML]
  );
  const pv = useMemo(
    () => solar(ref, { cobertura, custoKwp: parseNumberBR(custoKwp, null), hsp: parseNumberBR(hsp, 5.5) || 5.5 }),
    [ref, cobertura, custoKwp, hsp]
  );

  const segs = [
    { key: "energia", label: "Energia consumida", valor: partes.energia, cor: chart.series[0] },
    { key: "demanda", label: "Demanda e ultrapassagem", valor: partes.demanda, cor: chart.reference },
    { key: "reativo", label: "Reativo excedente", valor: partes.reativo, cor: chart.critical },
  ];
  const matriz = [
    { solucao: "Ajustar o contrato de demanda", energia: false, demanda: true, reativo: false },
    { solucao: "Corrigir o fator de potência", energia: false, demanda: false, reativo: true },
    { solucao: "Mercado livre", energia: "só a parte da energia (TE)", demanda: false, reativo: false },
    { solucao: "Energia solar", energia: true, demanda: false, reativo: false },
  ];

  return (
    <div className="lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Onde economizar</h1>
        <p className="text-sm text-slate-500">
          A partir da sua fatura de {mesRef} ({ref.subgrupo} {ref.modalidade}, {ref.distribuidora}). Primeiro entender, depois decidir.
        </p>
      </div>

      {/* Resposta */}
      <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/60">
        <p className="font-heading text-lg sm:text-xl font-bold text-slate-900 text-balance">
          Sem nenhuma obra, sua conta pode cair cerca de {brl(totalSemObra)} por mês.
        </p>
        <ContaAntesDepois
          total={partes.total}
          mesRef={mesRef}
          passos={[
            { label: "Ajustar o contrato de demanda", valor: demanda.economiaMes },
            { label: "Corrigir o fator de potência", valor: fp.economiaMes },
          ]}
          cores={{ conta: chart.series[0], economia: chart.series[1], trilho: chart.grid }}
        />
        <p className="text-xs text-slate-500 mt-3">
          Solar e mercado livre atuam em outra parte da conta: a energia consumida ({pct(partes.energia / partes.total)} do total).
        </p>
      </div>

      {/* O que cada solução reduz */}
      <section className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-5" aria-labelledby="partes-titulo">
        <div>
          <h2 id="partes-titulo" className="text-base font-bold text-slate-900">O que cada solução consegue reduzir</h2>
          <p className="text-xs text-slate-500">Sua conta de energia de {mesRef}: {brl(partes.total, 2)}</p>
        </div>

        <div className="flex h-4 w-full overflow-hidden rounded-full gap-0.5" role="img" aria-label={segs.map((s) => `${s.label} ${pct(s.valor / partes.total)}`).join(", ")}>
          {segs.map((s) => (
            <span key={s.key} style={{ width: `${(s.valor / partes.total) * 100}%`, background: s.cor }} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {segs.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.cor }} />
              <span className="text-slate-700">{s.label}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{pct(s.valor / partes.total)}</span>
              <span className="text-slate-500 tabular-nums">{brl(s.valor)}</span>
            </li>
          ))}
        </ul>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="text-left font-semibold px-2 py-2">Solução</th>
                <th className="font-semibold px-2 py-2">Energia</th>
                <th className="font-semibold px-2 py-2">Demanda e ultrapassagem</th>
                <th className="font-semibold px-2 py-2">Reativo</th>
              </tr>
            </thead>
            <tbody>
              {matriz.map((m) => (
                <tr key={m.solucao} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium text-slate-800">{m.solucao}</td>
                  {["energia", "demanda", "reativo"].map((k) => (
                    <td key={k} className="px-2 py-2.5 text-center">
                      {m[k] === true ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><Check className="h-4 w-4" /> reduz</span>
                      ) : m[k] ? (
                        <span className="text-xs text-slate-600">{m[k]}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400"><Minus className="h-4 w-4" /> não reduz</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Soluções, da mais simples para a que exige mais investimento */}
      <section className="space-y-3" aria-labelledby="solucoes-titulo">
        <h2 id="solucoes-titulo" className="text-base font-bold text-slate-900">Por onde começar</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <SolutionCard
            rank={1}
            icon={FileSignature}
            title="Ajustar o contrato de demanda"
            investment="nenhum"
            saving={`${brl(demanda.economiaMes)}/mês`}
            savingNote={`Média dos ${demanda.meses} meses do histórico (${brl(demanda.economiaPeriodo)} no período).`}
            cta={
              <Link
                to={`/documentos?contrato=${demanda.contratoSugeridoKw}`}
                className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold"
              >
                Gerar a solicitação para a Enel <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            <p>
              Você contrata <strong>{num(demanda.contratoAtualKw)} kW</strong>, mas usa entre{" "}
              {num(Math.min(...ref.historico.map((h) => h.demandaForaPontaKw)))} e{" "}
              {num(Math.max(...ref.historico.map((h) => h.demandaForaPontaKw)))} kW: paga multa de ultrapassagem todo mês. O contrato de
              menor custo para o seu histórico é <strong>{num(demanda.contratoSugeridoKw)} kW</strong>.
              <InfoTip>
                Demanda é a potência que a fábrica reserva na rede. Se usar mais que 5% acima do contratado, a parte excedente é cobrada
                em dobro (ultrapassagem).
              </InfoTip>
            </p>
          </SolutionCard>

          <SolutionCard
            rank={2}
            icon={Zap}
            title="Corrigir o fator de potência"
            investment={`banco de capacitores de ≈ ${num(Math.round(fp.kvar / 10) * 10)} kvar (peça orçamento)`}
            saving={`${brl(fp.economiaMes)}/mês`}
            savingNote={`O valor de reativo excedente cobrado em ${mesRef}.`}
            cta={
              <Link
                to="/reativo"
                className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
              >
                Ver o detalhe e o retorno <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            <p>
              No pico de consumo o fator de potência fica perto de <strong>{num(fp.fpPico, 2)}</strong>; abaixo de 0,92 a Enel cobra
              multa. Um banco de capacitores no quadro elimina essa cobrança.
            </p>
          </SolutionCard>

          <SolutionCard
            rank={3}
            icon={Store}
            title="Comprar energia no mercado livre"
            investment="sem obra; contrato com uma comercializadora"
            saving={ml.economiaMes != null ? `${brl(ml.economiaMes)}/mês` : "depende da oferta"}
            savingNote={
              ml.economiaMes != null
                ? ml.economiaMes > 0
                  ? "Com o preço e os custos informados abaixo."
                  : "Com esse preço, o mercado livre não compensa."
                : `Compensa se a oferta for menor que ${brl(ml.equilibrioMWh, 2)}/MWh (sem impostos).`
            }
          >
            <p>
              Troca só o fornecedor da energia ({brl(ml.teAtualMes)}/mês hoje). Continuam na conta: o uso da rede, a demanda e o reativo.
              <InfoTip>
                No mercado livre a empresa compra a energia de uma comercializadora a um preço negociado. Desde 2024, empresas do Grupo A
                podem migrar por meio de um comercializador varejista. A distribuidora continua entregando a energia e cobrando o uso da rede.
              </InfoTip>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ml-preco" className="block text-xs font-medium text-slate-700 mb-1">Preço ofertado (R$/MWh)</label>
                <input id="ml-preco" inputMode="decimal" placeholder="Da proposta da comercializadora" value={precoML} onChange={(e) => setPrecoML(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ml-custos" className="block text-xs font-medium text-slate-700 mb-1">
                  Custos fixos (R$/mês){" "}
                  <InfoTip>Gestão da comercializadora e encargos da CCEE (câmara que registra os contratos). Estão na proposta.</InfoTip>
                </label>
                <input id="ml-custos" inputMode="decimal" placeholder="Ex.: gestão + CCEE" value={custosML} onChange={(e) => setCustosML(e.target.value)} className={inputCls} />
              </div>
            </div>
          </SolutionCard>

          <SolutionCard
            rank={4}
            icon={Sun}
            title="Gerar a própria energia (solar)"
            investment={pv.investimento ? brl(pv.investimento) : "alto (peça orçamento a uma integradora)"}
            saving={`até ${brl(pv.economiaMes)}/mês`}
            savingNote={
              pv.paybackAnos
                ? `Retorno do investimento em cerca de ${num(pv.paybackAnos, 1)} anos.`
                : "Informe o custo por kWp do orçamento para ver o retorno."
            }
          >
            <div>
              <label htmlFor="pv-cob" className="block text-xs font-medium text-slate-700 mb-1">Quanto do consumo fora de ponta cobrir</label>
              <select id="pv-cob" value={cobertura} onChange={(e) => setCobertura(Number(e.target.value))} className={inputCls}>
                {[0.25, 0.5, 0.75, 1].map((c) => (
                  <option key={c} value={c}>{pct(c)}</option>
                ))}
              </select>
            </div>
            <p>
              Usina de <strong>{num(pv.kwp)} kWp</strong>, cerca de <strong>{num(pv.areaM2 / 1000, 1)} mil m²</strong> de painéis
              {pv.areaM2 > 3000 ? ": provavelmente fora do telhado, em geração remota" : ""}.
              <InfoTip>
                kWp é a potência da usina solar. Com geração distribuída (Lei 14.300/2022), a energia gerada vira crédito que abate o
                consumo da conta.
              </InfoTip>
            </p>
            <div>
              <label htmlFor="pv-custo" className="block text-xs font-medium text-slate-700 mb-1">Custo por kWp (R$)</label>
              <input id="pv-custo" inputMode="decimal" placeholder="Do orçamento da integradora" value={custoKwp} onChange={(e) => setCustoKwp(e.target.value)} className={inputCls} />
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-900">
              <Info className="h-4 w-4 shrink-0 mt-px" />
              <span>
                A solar <strong>não reduz {brl(pv.naoReduz)}/mês</strong> de demanda, ultrapassagem e reativo. E, pela Lei 14.300, parte do
                uso da rede continua cobrada sobre a energia compensada, então a economia real fica abaixo deste máximo.
              </span>
            </p>
          </SolutionCard>
        </div>
      </section>

      {/* Premissas */}
      <details className="rounded-2xl border border-slate-200 bg-white/50">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-700">Premissas e fontes dos cálculos</summary>
        <div className="px-6 pb-5 text-xs text-slate-600 space-y-2">
          <p>
            <strong>Fatura:</strong> {isReference ? ref.cliente : "sua fatura"} ({ref.subgrupo} {ref.modalidade}, {ref.distribuidora}), referência {mesRef}, valores com
            tributos (ICMS {num(ref.tributos.icms * 100)}%, PIS {num(ref.tributos.pis * 100, 2)}%, COFINS {num(ref.tributos.cofins * 100, 2)}%).
            Dados anonimizados.
          </p>
          <p>
            <strong>Contrato de demanda:</strong> menor custo de demanda + ultrapassagem nos {demanda.meses} meses do histórico, com a tarifa de
            demanda da fatura; ultrapassagem quando a medida passa de 105% da contratada.
          </p>
          <p>
            <strong>Fator de potência:</strong> economia = reativo excedente cobrado no mês. Tamanho do banco pela demanda ativa e reativa do
            pico (ordem de grandeza; o projeto define o valor exato).
          </p>
          <p>
            <strong>Mercado livre:</strong> ponto de equilíbrio = preço médio da energia (TE) sem tributos na fatura. Não inclui variação de
            preço ao longo do contrato.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <strong>Solar:</strong> geração = kWp × irradiação ×30 dias × 80% de desempenho; ~6 m² por kWp. Irradiação:
            <input
              aria-label="Irradiação solar (kWh/m² por dia)"
              inputMode="decimal"
              value={hsp}
              onChange={(e) => setHsp(e.target.value)}
              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
            />
            kWh/m²/dia (referência aproximada para o Ceará; confira a do seu município no CRESESB SunData).
          </div>
        </div>
      </details>
    </div>
  );
}
