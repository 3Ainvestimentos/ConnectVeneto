import OpenAI from 'openai';

/**
 * Cliente OpenAI para as rotas da Biblioteca Comercial.
 *
 * Só pode ser importado em código server-side (API routes): a chave não tem prefixo
 * `NEXT_PUBLIC_` justamente para nunca chegar ao browser. A CSP do app (`connect-src`
 * em next.config.ts) também não libera a API da OpenAI para o client.
 */

/** Modelo barato: as tarefas são de seleção e redação curta, não de raciocínio longo. */
export const OPENAI_MODEL = 'gpt-4o-mini';

let client: OpenAI | null = null;

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super('OPENAI_NOT_CONFIGURED');
  }
}

/** Permite responder 503 com mensagem clara em vez de estourar erro genérico. */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAINotConfiguredError();

  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Uma chamada de chat completion com resposta em JSON validado por schema
 * (structured outputs). O modelo não tem como devolver texto fora do formato,
 * então quem chama não precisa tratar parsing tolerante.
 */
export async function completeWithJsonSchema<T>(options: {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<T> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: options.maxOutputTokens ?? 800,
    messages: [
      { role: 'system', content: options.systemPrompt },
      ...options.messages,
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OPENAI_EMPTY_RESPONSE');

  return JSON.parse(content) as T;
}
