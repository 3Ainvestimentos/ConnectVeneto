/**
 * Exercita os prompts de catalogação direto contra a OpenAI, sem precisar de login
 * nem da interface. Usa o conteúdo real de um documento já publicado (baixado do
 * Storage e extraído do mesmo jeito que o navegador faz), então mostra exatamente
 * o rascunho e as respostas sugeridas que quem publica veria.
 *
 * Importa o mesmo módulo de prompts que a API usa — sem risco de testar outra coisa.
 *
 * Usage:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/try-assistant-prompt.ts
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/try-assistant-prompt.ts <docId>
 */
import OpenAI from 'openai';
import JSZip from 'jszip';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  buildAssistantResponseSchema,
  buildAssistantSystemPrompt,
  buildDraftSystemPrompt,
  draftResponseSchema,
  type AssistantModelResponse,
  type DraftModelResponse,
} from '../src/lib/biblioteca-comercial-prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/** Mesma extração de src/lib/document-text-extraction.ts (ramo .pptx). */
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const numberOf = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numberOf(a) - numberOf(b);
    });

  const slides: string[] = [];
  for (const path of slidePaths.slice(0, 25)) {
    const xml = await zip.files[path].async('string');
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => match[1]);
    if (texts.length > 0) slides.push(`Slide ${slides.length + 1}: ${texts.join(' ')}`);
    if (slides.join(' ').length > 8000) break;
  }
  return slides.join('\n').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

async function complete<T>(
  systemPrompt: string,
  userContent: string,
  schema: Record<string, unknown>,
  name: string
) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_completion_tokens: 700,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
  });
  return JSON.parse(response.choices[0].message.content ?? '{}') as T;
}

async function run() {
  const db = getFirestore();
  const docId = process.argv[2];
  const snapshot = docId
    ? await db.collection('commercialDocuments').doc(docId).get()
    : (await db.collection('commercialDocuments').limit(1).get()).docs[0];

  let fileName: string;
  let documentText: string;

  if (snapshot?.exists && snapshot.data()?.storagePath) {
    const data = snapshot.data()!;
    fileName = String(data.storagePath).split('/').pop() ?? 'arquivo';
    const [buffer] = await getStorage()
      .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
      .file(data.storagePath)
      .download();
    documentText = await extractPptx(buffer);
    console.log('arquivo (da biblioteca):', fileName);
  } else {
    // Sem documento publicado, usa uma amostra fiel ao material real da casa,
    // para o script continuar servindo para calibrar o prompt.
    fileName = 'Comparativo de Custo FE.pptx';
    documentText = [
      'Slide 1: Fundos Exclusivos 62% Patrimônio líquido alocado: R$ 32,83 milhões',
      'Taxa de administração: 0,20% ao ano Carteira Atual % da carteira PL por ativo',
      'Custo Rebate Custo Final Título Público 19,00% Emissão Primária 0,00%',
      'Crédito Privado Secundário 0,00% Ações 0,00% Fundo Renda Fixa 21,00%',
      'Fundo Multimercado 45,00% Fundo Ações 11,00% Fundo Internacional 4,00%',
      'Slide 2: Fundo Vêneto Perfil Conservador Comparação de custos entre as carteiras',
      'Taxa de Gestão 0,20% 0,50% Custo Implícito 1,88% 0,65% Total 2,08% 1,04%',
      'Diferença de taxa 1,04% Economia financeira real (a.a) Premissas adotadas:',
      'CDI = 12% a.a., FIRF = 120% CDI, FIM = 150% CDI, FIA = IBOV + 4%',
    ].join(' ');
    console.log('arquivo (amostra — biblioteca vazia):', fileName);
  }

  console.log('caracteres do conteúdo:', documentText.length);

  console.log('\n=== 1) rascunho da descrição (a partir do conteúdo) ===');
  const draft = await complete<DraftModelResponse>(
    buildDraftSystemPrompt(),
    [`Nome do arquivo: ${fileName}`, 'Tipo: ppt', '', 'Conteúdo lido do arquivo:', '"""', documentText, '"""'].join('\n'),
    draftResponseSchema,
    'rascunho'
  );
  console.log(draft.description);

  console.log('\n=== 2) perguntas com respostas sugeridas ===');
  const interview = await complete<AssistantModelResponse>(
    buildAssistantSystemPrompt('first'),
    [
      `Nome do arquivo: ${fileName}`,
      'Tipo: ppt',
      `Descrição do usuário: ${draft.description}`,
      '',
      'Conteúdo lido do arquivo:',
      '"""',
      documentText,
      '"""',
    ].join('\n'),
    buildAssistantResponseSchema('first'),
    'catalogacao'
  );

  reportInterview(interview);

  // Conteúdo rico costuma dispensar perguntas; este segundo cenário usa só um
  // trecho do início, que é o caso real de áudio parcial ou PDF digitalizado.
  console.log('\n=== 3) mesmo material com conteúdo escasso (força as perguntas) ===');
  const scarce = await complete<AssistantModelResponse>(
    buildAssistantSystemPrompt('first'),
    [
      `Nome do arquivo: ${fileName}`,
      'Tipo: ppt',
      'Descrição do usuário: material sobre custos',
      '',
      'Conteúdo lido do arquivo:',
      '"""',
      documentText.slice(0, 220),
      '"""',
    ].join('\n'),
    buildAssistantResponseSchema('first'),
    'catalogacao'
  );
  reportInterview(scarce);
}

function reportInterview(result: AssistantModelResponse) {
  if (result.status === 'questions') {
    for (const item of result.questions) {
      console.log(`\n  P: ${item.question}`);
      console.log(`  sugestão: ${item.suggestedAnswer || '(vazia — não deu para deduzir)'}`);
    }
    const semSugestao = result.questions.filter((q) => !q.suggestedAnswer).length;
    console.log(`\n  ${result.questions.length} pergunta(s), ${semSugestao} sem sugestão.`);
  } else {
    console.log('  (foi direto para os metadados finais — o conteúdo já bastava)');
    console.log('  título:', result.title);
    console.log('  tags:', JSON.stringify(result.tags));
  }
}

run().catch((error) => {
  console.error('falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
