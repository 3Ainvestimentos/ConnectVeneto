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

/**
 * Rascunho da descrição a partir do conteúdo lido do arquivo (texto do PDF, dos
 * slides ou a transcrição do áudio). Quem publica revisa antes de seguir — o
 * campo nasce preenchido em vez de em branco.
 */
export const buildDraftSystemPrompt = (): string =>
  [
    'Você descreve materiais da Biblioteca Comercial da Vêneto (uma gestora de patrimônio)',
    'a partir do conteúdo do próprio arquivo.',
    '',
    'Escreva 1 a 3 frases em português do Brasil dizendo o que é o material e para que',
    'serve, na perspectiva de um consultor que vai usá-lo com um cliente.',
    '',
    'Regras:',
    '- Descreva apenas o que estiver no conteúdo. Não invente produto, público ou data.',
    '- Não copie números, valores, nomes de clientes ou de instituições que apareçam no',
    '  material: a descrição é um resumo do tipo de documento, não dos dados dele.',
    '- Se o conteúdo for insuficiente para entender o material, devolva uma descrição',
    '  curta baseada só no nome do arquivo.',
    '- Não comece com "Este documento" repetidamente; escreva direto e natural.',
  ].join('\n');

export const draftResponseSchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Rascunho de 1 a 3 frases descrevendo o material.',
    },
  },
  required: ['description'],
  additionalProperties: false,
} as const;

export type DraftModelResponse = { description: string };

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
    'Cada pergunta vem com `suggestedAnswer`: a resposta que o conteúdo do arquivo indica,',
    'para quem publica só confirmar ou corrigir — é isso que torna a entrevista rápida.',
    '',
    'Preencha `suggestedAnswer` sempre que o conteúdo, o nome do arquivo ou o tipo de',
    'material derem base razoável para responder, ainda que parcialmente. Uma resposta',
    'curta e aproximada ("consultores em reunião com cliente", "fundos exclusivos e',
    'multimercado") é útil; o revisor corrige em segundos. Não pergunte algo que o',
    'conteúdo já responde: nesse caso não faça a pergunta.',
    '',
    'Deixe `suggestedAnswer` vazia apenas quando o material não disser absolutamente nada',
    'a respeito — datas de validade e nomes de produto costumam ser assim. Nunca invente',
    'número, data, nome de cliente ou de instituição que não esteja no conteúdo.',
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
      description: `Até ${MAX_ASSISTANT_QUESTIONS} perguntas objetivas, cada uma com a resposta sugerida pelo conteúdo. Vazio quando status = final.`,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'A pergunta, curta e específica.' },
          suggestedAnswer: {
            type: 'string',
            description:
              'Resposta deduzida do conteúdo do arquivo, para confirmar ou corrigir. Vazia se o conteúdo não permitir deduzir.',
          },
        },
        required: ['question', 'suggestedAnswer'],
        additionalProperties: false,
      },
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

export type AssistantQuestion = {
  question: string;
  /** Deduzida do conteúdo do arquivo; vazia quando não dá para deduzir. */
  suggestedAnswer: string;
};

export type AssistantModelResponse = {
  status: 'questions' | 'final';
  questions: AssistantQuestion[];
  title: string;
  description: string;
  tags: string[];
};
