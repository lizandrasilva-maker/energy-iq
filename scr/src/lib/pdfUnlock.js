// Abertura de faturas em PDF, inclusive as protegidas por senha.
//
// Um PDF com senha chega criptografado ao Gemini e não pode ser lido.
// Aqui o PDF é aberto no próprio navegador (pdf.js) com a senha e cada
// página é convertida em imagem; são as imagens que seguem para a IA.
// A senha nunca sai do navegador nem é gravada.

const MAX_PAGES = 4; // faturas têm 1–3 páginas; limita o tamanho do envio
const RENDER_SCALE = 2; // ~150 dpi: legível para a IA sem pesar demais
const JPEG_QUALITY = 0.85;

let pdfjsPromise = null;

/** Carrega o pdf.js só quando necessário (não pesa no carregamento do site). */
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export class PdfPasswordError extends Error {
  /** @param {"needed" | "incorrect"} reason */
  constructor(reason) {
    super(reason === "incorrect" ? "Senha incorreta." : "Este PDF está protegido por senha.");
    this.name = "PdfPasswordError";
    this.reason = reason;
  }
}

/**
 * Abre o PDF. Sem senha → detecta se é protegido.
 * Lança PdfPasswordError quando falta a senha ou ela está errada.
 */
export async function openPdf(file, password) {
  const pdfjs = await loadPdfjs();
  // pdf.js transfere o buffer para o worker; cada tentativa precisa de uma cópia nova.
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await pdfjs.getDocument({ data, password: password || undefined }).promise;
  } catch (err) {
    if (err?.name === "PasswordException") {
      throw new PdfPasswordError(
        err.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "incorrect" : "needed"
      );
    }
    throw new Error("Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.");
  }
}

/**
 * Senhas a testar a partir do que a pessoa digitou.
 * Distribuidoras costumam usar parte do CPF/CNPJ do titular (em geral os
 * 5 primeiros dígitos), então, se vier um documento completo, testamos
 * também os recortes mais comuns.
 */
export function passwordCandidates(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];
  const digits = raw.replace(/\D/g, "");
  const list = [raw];
  if (digits && digits !== raw) list.push(digits);
  if (digits.length === 11 || digits.length === 14) {
    list.push(digits.slice(0, 5), digits.slice(0, 4), digits.slice(0, 6), digits.slice(0, 8), digits.slice(-5), digits.slice(-4));
  }
  return [...new Set(list)];
}

/**
 * Tenta desbloquear com cada candidata. Devolve { doc, password } da que
 * funcionou ou lança PdfPasswordError("incorrect").
 */
export async function unlockPdf(file, input) {
  for (const candidate of passwordCandidates(input)) {
    try {
      const doc = await openPdf(file, candidate);
      return { doc, password: candidate };
    } catch (err) {
      if (!(err instanceof PdfPasswordError)) throw err;
    }
  }
  throw new PdfPasswordError("incorrect");
}

/**
 * Converte as páginas em JPEG (base64, sem o prefixo data:) e extrai o
 * texto, que ajuda a IA a ler números com precisão.
 */
export async function pdfToImages(doc, { scale = RENDER_SCALE, quality = JPEG_QUALITY } = {}) {
  const pages = Math.min(doc.numPages, MAX_PAGES);
  const images = [];
  let text = "";

  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // fundo branco: JPEG não tem transparência
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", quality).split(",")[1]);

    const content = await page.getTextContent();
    text += `\n--- Página ${n} ---\n` + content.items.map((i) => i.str).join(" ");
    page.cleanup();
  }

  return { images, text: text.trim(), totalPages: doc.numPages, sentPages: pages };
}

/** Libera o documento e o worker do pdf.js. */
export function closePdf(doc) {
  doc?.loadingTask?.destroy();
}
