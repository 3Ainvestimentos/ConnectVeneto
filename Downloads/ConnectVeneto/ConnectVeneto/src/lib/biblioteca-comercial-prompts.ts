/**
 * Prompts da Biblioteca Comercial.
 *
 * Vivem fora das route handlers porque arquivos `route.ts` do App Router só podem
 * exportar handlers HTTP — e sem poder exportar, não dá para exercitar o prompt
 * isoladamente contra o modelo quando o resultado sai ruim.
 */

export const MAX_ASSISTANT_QUESTIONS = 4;

/** Uma rodada de perguntas e o fechamento — a entrevista é curta de propósito. */
export const MAX_ASSISTANT_ROUNDS = 2;

/** Instruções de catalogação: é o que decide a qualidade da busca depois. */
export const buildAssistantSystemPrompt = (isLastRound: boolean): string =>
  [
    'Você ajuda a catalogar materiais da Biblioteca Comercial da Vêneto (uma gestora de',
    'patrimônio). Os documentos são usados por consultores em reunião com clientes:',
    'lâminas de fundos, apresentações institucionais, podcasts e materiais de apoio.',
    '',
    'A busca desses documentos é feita por IA apenas sobre título, descrição e tags —',
    'o conteúdo do arquivo não é lido. Por isso os metadados precisam conter os termos',
    'que um consultor usaria para pedir o material em voz alta.',
    '',
    'Sua tarefa: a partir do nome do arquivo e da descrição breve do usuário, decidir se',
    'faltam informações essenciais para catalogar bem (por exemplo: público-alvo,',
    'produto ou fundo tratado, finalidade do material, período de validade).',
    '',
    isLastRound
      ? 'Esta é a última rodada: responda com status "final", preenchendo title, description e tags com o que já tem.'
      : `Se faltarem informações, responda com status "questions" e no máximo ${MAX_ASSISTANT_QUESTIONS} perguntas curtas, objetivas e específicas (nunca genéricas como "fale mais sobre o arquivo"). Se já houver contexto suficiente, responda direto com status "final".`,
    '',
    'Quando status for "final":',
    '- title: curto e reconhecível, sem a extensão do arquivo, escrito como um título de',
    '  verdade em português — primeira letra maiúscula e nomes próprios capitalizados.',
    '  Siglas ficam em MAIÚSCULAS (FE, VP, PREV, CDB, FIC). Nunca devolva o título todo em',
    '  minúsculas nem todo em maiúsculas. Ex.: "Comparativo de Custo FE", não',
    '  "comparativo de custo fe".',
    '- description: 2 a 4 frases em português do Brasil, mencionando explicitamente produto,',
    '  público e finalidade.',
    '- tags: de 3 a 8, em minúsculas e com a acentuação correta do português ("análise", não',
    '  "analise") — a busca já ignora acentos. Não repita palavras que já estão no título.',
  ].join('\n');

/**
 * Schema estrito: o modo `strict` exige todos os campos, então os não usados voltam vazios.
 *
 * Na última rodada, `status` fica restrito a `final`. Só pedir no texto do prompt não
 * basta — na prática o modelo continuava devolvendo perguntas e metadados vazios, e o
 * cadastro terminava com a descrição crua do usuário. Tirar a opção do schema é o que
 * garante o desfecho.
 */
export const buildAssistantResponseSchema = (isLastRound: boolean) => ({
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: isLastRound ? ['final'] : ['questions', 'final'],
      description:
        'questions quando ainda faltam informações; final quando os metadados estão prontos.',
    },
    questions: {
      type: 'array',
      description: `Até ${MAX_ASSISTANT_QUESTIONS} perguntas objetivas. Vazio quando status = final.`,
      items: { type: 'string' },
    },
    title: {
      type: 'string',
      description: 'Título final do documento. Vazio quando status = questions.',
    },
    description: {
      type: 'string',
      description: 'Descrição final, rica em termos de busca. Vazio quando status = questions.',
    },
    tags: {
      type: 'array',
      description: 'De 3 a 8 tags em minúsculas. Vazio quando status = questions.',
      items: { type: 'string' },
    },
  },
  required: ['status', 'questions', 'title', 'description', 'tags'],
  additionalProperties: false,
});

export type AssistantModelResponse = {
  status: 'questions' | 'final';
  questions: string[];
  title: string;
  description: string;
  tags: string[];
};
