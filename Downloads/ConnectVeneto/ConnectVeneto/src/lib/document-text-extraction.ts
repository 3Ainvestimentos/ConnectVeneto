"use client";

/**
 * Leitura do conteúdo do arquivo no próprio navegador, para o assistente
 * catalogar a partir do que está escrito no documento — não só do nome do arquivo.
 *
 * A extração roda no client de propósito: o arquivo já está na máquina de quem
 * publica, e mandá-lo para uma API route esbarraria no limite de ~4,5 MB de body
 * da Vercel. Sobe só o texto extraído (poucos KB).
 *
 * Áudio é a exceção: transcrever exige o modelo, então vai um trecho inicial para
 * /api/biblioteca-comercial/transcribe.
 */

/** Teto do texto enviado ao modelo: o suficiente para descrever, sem inflar o prompt. */
const MAX_EXTRACTED_CHARS = 8000;
const MAX_PDF_PAGES = 12;
const MAX_PPTX_SLIDES = 25;

/** O body da Vercel não passa de ~4,5 MB; o trecho de áudio fica abaixo disso. */
const MAX_AUDIO_SLICE_BYTES = 4 * 1024 * 1024;

export type ExtractionResult = {
  text: string;
  /** De onde o texto veio — `none` quando não foi possível ler. */
  source: 'pdf' | 'pptx' | 'audio' | 'none';
  /** Explicação curta para a interface quando a leitura falha ou é parcial. */
  note?: string;
};

const clamp = (text: string): string =>
  text.length > MAX_EXTRACTED_CHARS ? `${text.slice(0, MAX_EXTRACTED_CHARS)}…` : text;

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

async function extractPdf(file: File): Promise<ExtractionResult> {
  // Import dinâmico: o pdf.js é pesado e só carrega quando alguém publica um PDF.
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
    if (pages.join(' ').length > MAX_EXTRACTED_CHARS) break;
  }

  const text = collapseWhitespace(pages.join('\n'));
  if (!text) {
    return {
      text: '',
      source: 'none',
      note: 'O PDF não tem texto selecionável (provavelmente digitalizado).',
    };
  }

  return {
    text: clamp(text),
    source: 'pdf',
    note:
      document.numPages > pageCount
        ? `Lidas as primeiras ${pageCount} de ${document.numPages} páginas.`
        : undefined,
  };
}

/**
 * .pptx é um zip de XML: o texto dos slides está nos elementos <a:t>.
 * Evita uma dependência de parser de Office só para ler algumas strings.
 */
async function extractPptx(file: File): Promise<ExtractionResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const numberOf = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numberOf(a) - numberOf(b);
    });

  if (slidePaths.length === 0) {
    return { text: '', source: 'none', note: 'Não encontrei slides neste arquivo.' };
  }

  const slides: string[] = [];
  for (const path of slidePaths.slice(0, MAX_PPTX_SLIDES)) {
    const xml = await zip.files[path].async('string');
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => match[1]);
    if (texts.length > 0) {
      slides.push(`Slide ${slides.length + 1}: ${texts.join(' ')}`);
    }
    if (slides.join(' ').length > MAX_EXTRACTED_CHARS) break;
  }

  const text = collapseWhitespace(slides.join('\n'));
  if (!text) {
    return {
      text: '',
      source: 'none',
      note: 'Os slides não têm texto — devem ser imagens.',
    };
  }

  return {
    text: clamp(text),
    source: 'pptx',
    note:
      slidePaths.length > MAX_PPTX_SLIDES
        ? `Lidos os primeiros ${MAX_PPTX_SLIDES} de ${slidePaths.length} slides.`
        : undefined,
  };
}

/**
 * Manda um trecho inicial do áudio para transcrição.
 *
 * Cortar bytes funciona bem em MP3 (sequência de frames independentes) e em WAV;
 * em M4A o índice pode ficar no fim do arquivo, e aí o corte é ilegível — nesse
 * caso a transcrição falha e o cadastro segue sem ela.
 */
async function extractAudio(file: File, idToken: string): Promise<ExtractionResult> {
  const isPartial = file.size > MAX_AUDIO_SLICE_BYTES;
  const slice = isPartial ? file.slice(0, MAX_AUDIO_SLICE_BYTES, file.type) : file;

  const formData = new FormData();
  formData.append('file', new File([slice], file.name, { type: file.type }));

  const response = await fetch('/api/biblioteca-comercial/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | { text?: string; error?: string }
    | null;

  if (!response.ok || !payload?.text) {
    return {
      text: '',
      source: 'none',
      note: payload?.error ?? 'Não consegui transcrever este áudio.',
    };
  }

  return {
    text: clamp(collapseWhitespace(payload.text)),
    source: 'audio',
    note: isPartial ? 'Transcrito só o início do áudio.' : undefined,
  };
}

/**
 * Lê o conteúdo do arquivo conforme o tipo. Nunca lança: quando não dá para ler,
 * devolve `source: 'none'` com a explicação, e o cadastro continua sem o texto.
 */
export async function extractDocumentText(
  file: File,
  idToken: string
): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();

  try {
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      return await extractPdf(file);
    }

    if (name.endsWith('.pptx')) {
      return await extractPptx(file);
    }

    // .ppt (binário, anterior a 2007) não é zip e exigiria um parser dedicado.
    if (name.endsWith('.ppt')) {
      return {
        text: '',
        source: 'none',
        note: 'Formato .ppt antigo: salve como .pptx para o assistente ler o conteúdo.',
      };
    }

    if (file.type.startsWith('audio/') || /\.(mp3|m4a|wav)$/.test(name)) {
      return await extractAudio(file, idToken);
    }

    return { text: '', source: 'none', note: 'Tipo de arquivo sem leitura automática.' };
  } catch (error) {
    return {
      text: '',
      source: 'none',
      note: error instanceof Error ? `Falha ao ler o arquivo: ${error.message}` : 'Falha ao ler o arquivo.',
    };
  }
}
