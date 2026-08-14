/**
 * Exercita o prompt do assistente de catalogação direto contra a OpenAI, sem
 * precisar de login nem da interface. Serve para inspecionar o que o modelo
 * devolve quando um cadastro real sai ruim (título em minúsculas, tags sem
 * acento, perguntas genéricas) e para conferir ajustes de prompt.
 *
 * Importa o mesmo módulo que a API usa, então não há risco de testar um prompt
 * diferente do que roda em produção.
 *
 * Usage:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/try-assistant-prompt.ts
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/try-assistant-prompt.ts "Arquivo.pptx" "descrição breve"
 */
import OpenAI from 'openai';
import {
  buildAssistantResponseSchema,
  buildAssistantSystemPrompt,
  type AssistantModelResponse,
} from '../src/lib/biblioteca-comercial-prompts';

const fileName = process.argv[2] ?? 'Comparativo de Custo FE.pptx';
const userDescription = process.argv[3] ?? 'comparativo de custos de fundos exclusivos';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function ask(isLastRound: boolean, userContent: string): Promise<AssistantModelResponse> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_completion_tokens: 700,
    messages: [
      { role: 'system', content: buildAssistantSystemPrompt(isLastRound) },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'catalogacao',
        strict: true,
        schema: buildAssistantResponseSchema(isLastRound),
      },
    },
  });
  return JSON.parse(response.choices[0].message.content ?? '{}') as AssistantModelResponse;
}

// Envolvido em função: o projeto é CommonJS e não aceita await no topo do módulo.
async function run() {
  const base = `Nome do arquivo: ${fileName}\nTipo: ppt\nDescrição do usuário: ${userDescription}`;

  console.log('=== rodada 0 (o assistente ainda pode perguntar) ===');
  const first = await ask(false, base);
  console.log(JSON.stringify(first, null, 2));

  // Reproduz o botão "Pular perguntas": nada respondido, entrevista encerrada na hora.
  console.log('\n=== "Pular perguntas" (nada respondido, pior caso) ===');
  const answers = (first.questions ?? []).map((q) => `- ${q} → (não respondido)`).join('\n');
  const final = await ask(true, `${base}\n\nRespostas já obtidas:\n${answers}`);
  console.log(JSON.stringify(final, null, 2));

  console.log('\n=== veredito ===');
  const title = final.title ?? '';
  console.log('título:', JSON.stringify(title));
  console.log(
    '  todo em minúsculas?',
    title && title === title.toLowerCase() ? 'SIM (problema)' : 'não'
  );
  console.log('  contém sigla em maiúsculas?', /\b[A-Z]{2,}\b/.test(title) ? 'sim' : 'não');
  console.log('tags:', JSON.stringify(final.tags));
  console.log(
    '  tags acentuadas?',
    (final.tags ?? []).some((tag) => /[áàâãéêíóôõúç]/i.test(tag)) ? 'sim' : 'nenhuma'
  );
}

run().catch((error) => {
  console.error('falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
