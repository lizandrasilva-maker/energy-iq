import { useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Wrench, PiggyBank, ArrowRight } from "lucide-react";
import InfoTip from "./ui/InfoTip";
import { capacitorKvar, PF_MIN } from "@/lib/electrical";
import { parseNumberBR } from "@/lib/billParsing";
import { useChartTheme } from "./charts/ChartKit";
import PfGauge from "./charts/PfGauge";

const brl = (v, d = 0) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v, d = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Reativo em linguagem de cliente, a partir da fatura:
 * quanto paga, do que precisa e se vale a pena.
 */
export default function ReactiveSummary({ fatura, onVerSetores }) {
  const chart = useChartTheme();
  const [precoBanco, setPrecoBanco] = useState("");

  const itens = fatura.itens.filter((i) => i.componente === "reativo");
  const custoMes = itens.reduce((t, i) => t + i.valor, 0);
  const pctConta = custoMes / fatura.subtotalFaturamento;

  // Fator de potência no pico: demanda ativa × demanda reativa da fatura
  const P = fatura.medicao.demandaForaPontaKw;
  const Q = fatura.medicao.demandaReativaForaPontaKvar;
  const fpPico = P / Math.hypot(P, Q);
  const kvar = capacitorKvar(P, fpPico, PF_MIN);

  const preco = parseNumberBR(precoBanco, null);
  const paybackMeses = preco && custoMes > 0 ? preco / custoMes : null;
  const mesRef = fatura.referencia.split("-").reverse().join("/");

  return (
    <section className="space-y-4" aria-labelledby="reativo-resposta">
      <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/60">
        {custoMes > 0 ? (
          <>
            <p id="reativo-resposta" className="font-heading text-lg sm:text-xl font-bold text-slate-900 text-balance">
              Corrigir o fator de potência eliminaria cerca de {brl(custoMes)} por mês da sua conta
              (cerca de {brl(custoMes * 12)} por ano).
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Hoje você paga uma multa por energia reativa: energia que circula nos motores e transformadores sem virar trabalho.
              A distribuidora cobra quando o fator de potência fica abaixo de 0,92.
            </p>
          </>
        ) : (
          <>
            <p id="reativo-resposta" className="font-heading text-lg sm:text-xl font-bold text-slate-900 text-balance">
              Nesta fatura não há multa de reativo: o fator de potência ficou dentro do limite.
            </p>
            <p className="text-sm text-slate-600 mt-1">
              A distribuidora cobra quando o fator de potência fica abaixo de 0,92. Acompanhe os setores abaixo para continuar assim.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Quanto você paga */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Receipt className="h-4 w-4 text-sky-500" /> 1. Quanto você paga
          </p>
          <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums">{brl(custoMes, 2)}</p>
          <p className="text-sm text-slate-600">
            de reativo excedente na fatura de {mesRef}, {num(pctConta * 100, 1)}% da conta de energia.
          </p>
          <p className="text-xs text-slate-500">
            {itens
              .map((i) => /^Demanda/.test(i.descricao)
                ? `${i.descricao}: ${num(i.quantidade, 2)} kvar`
                : `${i.descricao.replace("Consumo reativo excedente ", "")}: ${num(i.quantidade)} kVArh`)
              .join(" · ")}
            <InfoTip>
              kVArh é a unidade da energia reativa. A distribuidora mede hora a hora e cobra a parte que passa do limite
              permitido (fator de potência 0,92). Por isso a multa aparece mesmo quando a média do mês parece boa.
            </InfoTip>
          </p>
        </div>

        {/* 2. Do que você precisa */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Wrench className="h-4 w-4 text-sky-500" /> 2. Do que você precisa
          </p>
          <div className="flex justify-center text-slate-900">
            <PfGauge value={fpPico} label="fator de potência no pico" />
          </div>
          <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums text-center">
            ≈ {num(Math.max(1, Math.round(kvar / 10) * 10))} kvar
            <InfoTip>
              kvar é o tamanho do banco de capacitores: o equipamento que fornece a energia reativa dentro da fábrica, para
              ela não vir da rede. Instalado no quadro, ele corrige o fator de potência. Estimado pela fatura ({num(P, 0)} kW
              e {num(Q, 0)} kVAr no pico); o valor exato sai da medição por setor.
            </InfoTip>
          </p>
          <p className="text-sm text-slate-600 text-center">de banco de capacitores leva o ponteiro para a faixa verde.</p>
          <p className="text-xs text-slate-500 text-center">
            {" "}
            {onVerSetores && (
              <button type="button" onClick={onVerSetores} className="font-semibold text-sky-600 hover:underline cursor-pointer">
                Ver onde instalar
              </button>
            )}
          </p>
        </div>

        {/* 3. Vale a pena? */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <PiggyBank className="h-4 w-4 text-sky-500" /> 3. Vale a pena?
          </p>

          {/* Antes × depois */}
          <div className="space-y-2" aria-label={`Antes ${brl(custoMes)} por mês, depois R$ 0`}>
            {[
              { label: "Hoje", valor: custoMes, cor: chart.critical },
              { label: "Com o banco", valor: 0, cor: chart.series[1] },
            ].map((b) => (
              <div key={b.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <span className="text-slate-600">{b.label}</span>
                <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: b.valor ? "100%" : "2%", background: b.cor }} />
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">{brl(b.valor)}/mês</span>
              </div>
            ))}
          </div>

          <label htmlFor="preco-banco" className="text-xs font-medium text-slate-700">
            Preço do banco no orçamento (R$)
          </label>
          <input
            id="preco-banco"
            inputMode="decimal"
            placeholder="Cole aqui o valor do orçamento"
            value={precoBanco}
            onChange={(e) => setPrecoBanco(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <p className="text-sm text-slate-600 min-h-[2.5rem]">
            {paybackMeses ? (
              <>
                O banco se paga em <strong className="text-slate-900">{num(paybackMeses, 1)} meses</strong>
                {paybackMeses <= 12 ? ", menos de um ano." : "."}
              </>
            ) : (
              "Informe o preço de um orçamento para ver em quanto tempo o investimento se paga."
            )}
          </p>
          <Link
            to="/prestadores"
            className="mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold"
          >
            Pedir orçamento a fornecedores <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
