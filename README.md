# EnergyIQ — nova versão

**EnergyIQ** é a plataforma da startup **Enerlytics** para consumidores do **Grupo A** (média e alta tensão): lê a fatura de energia, mostra o que torna a conta cara e indica o caminho para economizar antes de investir. Um sensor de baixo custo (ESP32 + PZEM-004T) completa o diagnóstico medindo o consumo por setor.

Projeto do **INTEGRA SENAI 2026** (SENAI Ceará — CFP Waldyr Diogo de Siqueira), em resposta ao desafio da **Scalasolar**: *análise tarifária e viabilidade energética para consumidores do Grupo A*.

- Site: **https://energy-iq-tau.vercel.app**
- Princípio: **primeiro entender, depois decidir.** A leitura da fatura e todas as contas de tarifa são regras fixas e verificáveis, conferidas contra faturas reais. Sem custo de IA por fatura.

---

## O que o cliente vê

| Tela | Para que serve |
|---|---|
| **Dashboard** | Indicadores da fatura, **raio-x** (quanto cada componente pesa na conta e o que é evitável), demanda e consumo de 13 meses |
| **Demanda** | Histórico real, ultrapassagens e **simulação do contrato de demanda** (o contrato de menor custo para o histórico) |
| **Reativo** | Quanto se paga de reativo, o tamanho do banco de capacitores, se vale a pena (com o preço do orçamento) e o fator de potência por setor medido pelos sensores |
| **Sensores** | Medição por equipamento/setor em tempo real (potência, FP, reativa estimada, harmônicas simuladas ou medidas), histórico de energia |
| **Onde economizar** | O que cada solução reduz na conta: contrato de demanda, fator de potência, mercado livre e solar — da mais simples para a de maior investimento |
| **Documentos** | Carta de pedido de novo contrato de demanda para a Enel, gerada a partir do histórico, e acompanhamento do pedido |
| **Analisar nova fatura** | O cliente envia o PDF da Enel CE (inclusive com senha); a fatura é lida **no navegador**, conferida com o subtotal impresso e, com *Aplicar ao painel*, passa a alimentar todas as telas |

Sem fatura enviada, as telas mostram uma **fatura real de indústria A4 Verde da Enel CE (08/2024), anonimizada** (ver *Dados e LGPD*). A fatura enviada fica salva só no navegador do cliente e pode ser trocada de volta pela de exemplo.

---

## Como funciona

```
Fatura em PDF ──► navegador: abre com senha (pdf.js) ──► leitor por regras Enel CE ──► raio-x e simulações
                  (o arquivo não sai do computador do cliente)

ESP32 + PZEM (firmware v2) ──► /api/sensor (token do dispositivo) ──► Supabase da nova versão
                                                                              │
Site (React) ◄── lê as medições ──┬───────────────────────────────────────────┘
                                  └── e, SOMENTE LEITURA, o banco do protótipo original
```

- **Duas fontes de medição.** O protótipo original (firmware v1) continua gravando no banco dele; esta versão só **lê** de lá. O que chega pelo firmware v2 vai para o banco da nova versão. Para cada sensor vale **quem enviou por último**; o histórico junta as duas fontes. Se uma fonte cair, a outra continua.
- **Leitura da fatura por regras** (`scr/src/lib/enelBillParser.js`), sem IA: lê do texto do PDF os itens (com quantidade, tarifa e valor), a medição, os tributos, a demanda contratada e o histórico de 13 meses, e **confere a soma dos itens com o subtotal impresso**. Não lê nome, CPF/CNPJ nem endereço. Testado em faturas A4 Verde reais, inclusive com créditos de geração; fatura do Grupo B é recusada com explicação. Outras distribuidoras serão tratadas caso a caso (um leitor por layout).
- **Regras de cálculo** (pasta `scr/src/lib/`), conferidas na fatura de referência:
  - preço com tributos = tarifa ÷ [(1 − PIS − COFINS) × (1 − ICMS)];
  - ultrapassagem: demanda medida acima de 105% da contratada → excedente cobrado em dobro;
  - reativo excedente quando o fator de potência fica abaixo de 0,92 (REN ANEEL 1.000/2021);
  - banco de capacitores: Qc = P × (tg φ₁ − tg φ₂).
- **O que depende de fornecedor não é inventado.** Preço do mercado livre, custo da usina solar e do banco de capacitores entram como premissas informadas pelo usuário (orçamentos). O site mostra, por exemplo, o **preço de equilíbrio** do mercado livre.

---

## Estrutura

```
scr/                     site (React + Vite + Tailwind) e funções serverless
  api/                   funções da Vercel: sensor.js; analisar-fatura.js (leitura por IA, desativada no site)
  src/pages/             telas
  src/components/        componentes (raio-x, simuladores, gráficos, layout)
  src/lib/               regras: enelBillParser (leitura da fatura), currentBill, electrical, billXray, savings, telemetry, pdfUnlock
  src/data/              fatura de referência (anonimizada), tarifas ANEEL, planta/sensores
  scripts/               atualizar-tarifas.mjs
firmware/esp32_pzem/     firmware v2 do ESP32 (senhas em secrets.h, fora do Git)
supabase/                migrações e SQL de preparação do banco da nova versão
```

---

## Rodar localmente

Requisitos: Node.js 20+.

```bash
git clone https://github.com/lizandrasilva-maker/energy-iq.git
cd energy-iq/scr
npm install
cp .env.example .env.local   # e preencha (valores com a equipe, nunca no GitHub)
npm run dev                  # http://localhost:5173
```

O `npm run dev` também roda as funções de `scr/api` localmente, no mesmo formato e com o mesmo limite de envio (4,5 MB) da Vercel.

### Variáveis de ambiente

| Variável | Onde é usada | Observação |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` | navegador | banco da nova versão; chave **pública** (publishable/anon) |
| `VITE_SUPABASE_ORIGINAL_URL`, `VITE_SUPABASE_ORIGINAL_KEY` | navegador | opcional; banco do original, **somente leitura** |
| `GEMINI_API_KEY` | servidor (`/api/analisar-fatura`) | opcional, hoje sem uso no site; **nunca** com prefixo `VITE_` |
| `SUPABASE_URL`, `SUPABASE_KEY` | servidor (`/api/sensor`) | chave **secreta**; só no servidor |
| `DEVICE_TOKEN` | servidor (`/api/sensor`) | o mesmo valor vai no `secrets.h` do firmware |

Na Vercel: *Settings → Environment Variables*, depois *Redeploy*. Cada `git push` na `main` publica sozinho.

---

## Banco de dados (Supabase da nova versão)

No *SQL Editor* do projeto da nova versão, rode em ordem:

1. `supabase/setup_banco_testes.sql` — tabela `measurements`, regras de leitura e tempo real (migrações 0001 e 0002);
2. `supabase/rodar_agora_nova_versao.sql` — energia e frequência, e fecha a gravação pela chave pública (0003 e 0004).

> ⚠️ Nunca rode estes scripts no banco do projeto original.

## Firmware v2 (`firmware/esp32_pzem`)

1. Copie `secrets.example.h` para `secrets.h` e preencha Wi-Fi e `DEVICE_TOKEN` (o mesmo da Vercel).
2. Abra `esp32_pzem.ino` na Arduino IDE (placa ESP32; bibliotecas *PZEM004Tv30* e *ArduinoJson 7*) e grave.
3. No monitor serial (115200), cada leitura enviada aparece com ✅.

O firmware v2 descarta as leituras iniciais e as corrompidas (faixa do PZEM e coerência P ≈ V·I·FP), envia energia e frequência e não guarda chave do banco. **Ainda precisa ser testado em bancada.** O PZEM-004T não mede harmônicas: o site mostra THD **simulado** pelo tipo de carga e passa a **medido** quando a leitura trouxer `thd_current`/`thd_voltage`.

## Tarifas

`scr/src/data/tarifas-enel-ce-a4.json` vem dos **dados abertos da ANEEL** (mesma base do painel *Luz na Tarifa*). A cada reajuste:

```bash
cd scr && node scripts/atualizar-tarifas.mjs
```

---

## Original × nova versão

O protótipo original (site, firmware v1 e banco) é mantido **sem nenhuma alteração** por esta versão. Esta versão só lê as medições dele. Toda mudança acontece aqui.

## Dados e LGPD

- A fatura de referência está **anonimizada** (`scr/src/data/faturaReferencia.js`): sem nome, CNPJ, endereço, instalação ou medidor. O PDF não fica no repositório.
- Faturas analisadas pelo site são lidas **no navegador do cliente**: o PDF não é enviado a servidor nem a serviço de IA. Só números são extraídos; a fatura aplicada fica salva apenas naquele navegador.
- Senha de PDF de fatura é usada só no navegador e não é enviada nem salva.
- Senhas e chaves nunca vão para o Git (`.env.local`, `secrets.h` estão no `.gitignore`).

## Limitações conhecidas

- Empresa, faturas, equipamentos e pedidos ainda não são salvos no banco (próxima etapa); a fatura aplicada e os pedidos de demanda ficam no navegador.
- A leitura automática cobre faturas em PDF da Enel CE do Grupo A. Foto ou fatura digitalizada não é lida. Na modalidade Azul, as simulações de demanda ainda consideram só a demanda fora de ponta.
- O simulador de demanda usa a mesma tarifa em todos os meses: compara contratos, não prevê faturas.
- A economia da solar é a máxima (não desconta a parcela da Lei 14.300/2022 sobre a energia compensada).
- A configuração do ESLint herdada do original não funciona; a validação é feita pelo build e por testes no navegador.

## Uso de inteligência artificial

O produto não usa IA para ler faturas (leitura por regras). A auditoria do código, o redesign e as correções desta versão tiveram apoio do Claude (Anthropic), com revisão da equipe (registro na Entrega 7 do INTEGRA).
