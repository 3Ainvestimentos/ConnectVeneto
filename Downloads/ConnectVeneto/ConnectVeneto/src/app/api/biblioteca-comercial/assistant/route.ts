import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireBibliotecaComercialManager,
  securityErrorResponse,
} from '@/lib/security';
import { completeWithJsonSchema } from '@/lib/openai';
import {
  buildAssistantResponseSchema,
  buildAssistantSystemPrompt,
  MAX_ASSISTANT_QUESTIONS as MAX_QUESTIONS,
  MAX_ASSISTANT_ROUNDS as MAX_ROUNDS,
  type AssistantModelResponse,
  type AssistantPhase,
} from '@/lib/biblioteca-comercial-prompts';

/** Teto do conteúdo lido do arquivo, alinhado ao que o client extrai. */
const MAX_DOCUMENT_TEXT = 8100;

const payloadSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  fileType: z.enum(['pdf', 'ppt', 'audio', 'link']),
  userDescription: z
    .string()
    .trim()
    .min(3, 'Escreva uma descrição breve para o assistente trabalhar.')
    .max(1000),
  /** Texto lido do próprio arquivo no navegador (páginas, slides ou transcrição). */
  documentText: z.string().trim().max(MAX_DOCUMENT_TEXT).default(''),
  /** Rodadas de entrevista já respondidas. */
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().max(500),
      })
    )
    .max(MAX_QUESTIONS * MAX_ROUNDS)
    .default([]),
  /** Quantas rodadas de perguntas já aconteceram — limita a entrevista. */
  round: z.number().int().min(0).max(MAX_ROUNDS).default(0),
  /**
   * "Pular perguntas": o usuário decidiu que as perguntas não se aplicam. Encerra a
   * entrevista já nesta chamada, com o contexto que houver.
   */
  finalize: z.boolean().default(false),
});

/**
 * Assistente de catalogação: entrevista quem está subindo o arquivo para preencher as
 * lacunas da descrição e gerar metadados que a busca por IA consiga usar.
 */
export async function POST(request: Request) {
  try {
    const context = await requireBibliotecaComercialManager(request.headers.get('Authorization'));

    const rawBody = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Requisicao invalida.' },
        { status: 400 }
      );
    }

    const { fileName, fileType, userDescription, documentText, answers, round, finalize } =
      parsed.data;

    const isLastRound = finalize || round >= MAX_ROUNDS - 1;
    // A primeira rodada sempre pergunta: é a etapa em que quem publica confirma o
    // que a IA deduziu do arquivo. "Pular perguntas" (finalize) tem precedência.
    const phase: AssistantPhase = isLastRound ? 'last' : round === 0 ? 'first' : 'open';

    const userContent = [
      `Nome do arquivo: ${fileName}`,
      `Tipo: ${fileType}`,
      `Descrição do usuário: ${userDescription}`,
      ...(documentText
        ? ['', 'Conteúdo lido do arquivo:', '"""', documentText, '"""']
        : ['', '(Não foi possível ler o conteúdo do arquivo.)']),
      ...(answers.length > 0
        ? [
            '',
            'Respostas já obtidas:',
            ...answers.map((item) => `- ${item.question} → ${item.answer || '(não respondido)'}`),
          ]
        : []),
    ].join('\n');

    const result = await completeWithJsonSchema<AssistantModelResponse>({
      systemPrompt: buildAssistantSystemPrompt(phase),
      messages: [{ role: 'user', content: userContent }],
      schemaName: 'biblioteca_comercial_catalogacao',
      schema: buildAssistantResponseSchema(phase),
      maxOutputTokens: 700,
    });

    // Rede de segurança: se o modelo pedir perguntas na última rodada, força o desfecho.
    if (result.status === 'questions' && (isLastRound || result.questions.length === 0)) {
      return NextResponse.json(
        {
          status: 'final',
          title: result.title || fileName.replace(/\.[^.]+$/, ''),
          description: result.description || userDescription,
          tags: result.tags.slice(0, 8),
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    logSecurityEvent('[api/biblioteca-comercial/assistant] entrevista', {
      email: context.email,
      status: result.status,
      round,
    });

    if (result.status === 'questions') {
      return NextResponse.json(
        {
          status: 'questions',
          questions: result.questions.slice(0, MAX_QUESTIONS).map((item) => ({
            question: item.question,
            suggestedAnswer: item.suggestedAnswer ?? '',
          })),
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    return NextResponse.json(
      {
        status: 'final',
        title: result.title,
        description: result.description,
        tags: result.tags.slice(0, 8),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/biblioteca-comercial/assistant] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/biblioteca-comercial/assistant] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'O assistente não respondeu. Preencha os campos manualmente e tente de novo.' },
      { status: 500 }
    );
  }
}
