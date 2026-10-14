// Função serverless: analisa a fatura com o Gemini.
//
// A chave (GEMINI_API_KEY) e o prompt ficam só no servidor. O navegador
// envia apenas os arquivos da fatura: o PDF original ou, quando o PDF tem
// senha, as páginas já desbloqueadas como imagem + o texto extraído.
//
// Formato Web padrão (Request → Response): roda na Vercel e, localmente,
// pelo middleware do vite.config.js. Netlify aceita o mesmo formato.

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"]; // principal e reserva
const MAX_FILES = 8;
const MAX_TEXT_CHARS = 200_000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const PROMPT = `
Você é um auditor sênior de faturas de energia elétrica industrial do Grupo A (Tarifa Verde/Azul).
Analise este documento e retorne EXCLUSIVAMENTE um objeto JSON válido sem formatação markdown extra.

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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

function readRequest(body) {
  const files = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0 || files.length > MAX_FILES) {
    return { error: `Envie de 1 a ${MAX_FILES} arquivos da fatura.` };
  }
  for (const f of files) {
    if (!ALLOWED_TYPES.has(f?.mimeType) || typeof f?.data !== "string" || !f.data) {
      return { error: "Arquivo em formato não aceito. Use PDF, JPG ou PNG." };
    }
  }
  const text = typeof body?.text === "string" ? body.text.slice(0, MAX_TEXT_CHARS) : "";
  const pages = body?.pages && Number.isFinite(body.pages.total) && Number.isFinite(body.pages.sent) ? body.pages : null;
  return { files, text, pages };
}

async function callGemini(model, key, parts) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, response_mime_type: "application/json" },
    }),
  });
}

export async function POST(request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "Serviço de análise não configurado (GEMINI_API_KEY ausente no servidor)." }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const input = readRequest(body);
  if (input.error) return json({ error: input.error }, 400);

  const note = input.pages && input.pages.total > input.pages.sent
    ? `\nObservação: a fatura tem ${input.pages.total} páginas; foram enviadas as ${input.pages.sent} primeiras.`
    : "";
  const parts = [
    { text: PROMPT + note },
    ...input.files.map((f) => ({ inline_data: { mime_type: f.mimeType, data: f.data } })),
    ...(input.text ? [{ text: `Texto extraído do PDF (use para conferir os números):\n${input.text}` }] : []),
  ];

  let response = null;
  for (const model of MODELS) {
    try {
      response = await callGemini(model, key, parts);
    } catch {
      response = null; // falha de rede: tenta o próximo modelo
      continue;
    }
    if (response.ok || response.status === 429 || response.status === 400) break;
  }

  if (!response) return json({ error: "Não foi possível falar com o serviço de IA. Tente de novo." }, 502);
  if (response.status === 429) {
    return json({ error: "Limite de requisições atingido. Aguarde 1 minuto e tente novamente." }, 429);
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    return json({ error: detail?.error?.message || `Erro no serviço de IA (${response.status}).` }, 502);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return json({ error: "A IA não conseguiu ler esta fatura." }, 422);

  try {
    return json(JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()));
  } catch {
    return json({ error: "A IA respondeu em um formato inesperado. Tente de novo." }, 502);
  }
}
