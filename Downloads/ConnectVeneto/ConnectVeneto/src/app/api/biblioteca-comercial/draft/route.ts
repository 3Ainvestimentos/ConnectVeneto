import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireBibliotecaComercialManager,
  securityErrorResponse,
} from '@/lib/security';
import { completeWithJsonSchema } from '@/lib/openai';
import {
  buildDraftSystemPrompt,
  draftResponseSchema,
  type DraftModelResponse,
} from '@/lib/biblioteca-comercial-prompts';

const MAX_DOCUMENT_TEXT = 8100;

const payloadSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  fileType: z.enum(['pdf', 'ppt', 'audio', 'link']),
  /** Texto lido do arquivo no navegador. Sem ele não há o que resumir. */
  documentText: z.string().trim().min(1, 'Sem conteúdo para descrever.').max(MAX_DOCUMENT_TEXT),
});

/**
 * Redige o rascunho da descrição a partir do conteúdo do próprio arquivo, para o
 * campo já nascer preenchido em vez de exigir que quem publica escreva do zero.
 *
 * Quem publica revisa e edita antes de seguir — o rascunho é ponto de partida,
 * não verdade final.
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

    const { fileName, fileType, documentText } = parsed.data;

    const result = await completeWithJsonSchema<DraftModelResponse>({
      systemPrompt: buildDraftSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            `Nome do arquivo: ${fileName}`,
            `Tipo: ${fileType}`,
            '',
            'Conteúdo lido do arquivo:',
            '"""',
            documentText,
            '"""',
          ].join('\n'),
        },
      ],
      schemaName: 'biblioteca_comercial_rascunho',
      schema: draftResponseSchema,
      maxOutputTokens: 300,
    });

    logSecurityEvent('[api/biblioteca-comercial/draft] rascunho gerado', {
      email: context.email,
      chars: documentText.length,
    });

    return NextResponse.json(
      { description: result.description },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/biblioteca-comercial/draft] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/biblioteca-comercial/draft] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    // Rascunho é conveniência: sem ele, quem publica escreve a descrição à mão.
    return NextResponse.json({ error: 'Não consegui redigir a descrição.' }, { status: 500 });
  }
}
