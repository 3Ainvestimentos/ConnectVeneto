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
  buildImageDraftSystemPrompt,
  draftResponseSchema,
  type DraftModelResponse,
} from '@/lib/biblioteca-comercial-prompts';

const MAX_DOCUMENT_TEXT = 8100;

/**
 * Teto do data URL da imagem. O client já reduz a imagem antes de enviar; este
 * limite existe para o corpo da requisição não passar do que a Vercel aceita (~4,5 MB)
 * mesmo se alguém chamar a rota direto.
 */
const MAX_IMAGE_DATA_URL_CHARS = 3_000_000;

const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * O rascunho vem do texto lido do arquivo ou, quando o material é uma imagem, da
 * própria imagem — nunca dos dois. Imagem não tem texto para o browser extrair:
 * quem lê é o modelo de visão.
 */
const payloadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(300),
    fileType: z.enum(['pdf', 'ppt', 'audio', 'image', 'link']),
    /** Texto lido do arquivo no navegador. */
    documentText: z.string().trim().max(MAX_DOCUMENT_TEXT).optional(),
    /** Imagem já reduzida no navegador, em data URL. */
    imageDataUrl: z
      .string()
      .trim()
      .max(MAX_IMAGE_DATA_URL_CHARS, 'Imagem grande demais para leitura.')
      .refine((value) => IMAGE_DATA_URL.test(value), 'Imagem inválida.')
      .optional(),
  })
  .refine(
    (value) => !!value.documentText || !!value.imageDataUrl,
    'Sem conteúdo para descrever.'
  );

/**
 * Redige o rascunho da descrição a partir do conteúdo do próprio arquivo — o texto
 * lido no navegador ou, quando o material é uma imagem, a peça vista pelo modelo —
 * para o campo já nascer preenchido em vez de exigir que quem publica escreva do zero.
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

    const { fileName, fileType, documentText, imageDataUrl } = parsed.data;

    const result = await completeWithJsonSchema<DraftModelResponse>({
      systemPrompt: imageDataUrl ? buildImageDraftSystemPrompt() : buildDraftSystemPrompt(),
      messages: [
        imageDataUrl
          ? {
              role: 'user',
              content: [
                { type: 'text', text: `Nome do arquivo: ${fileName}\nTipo: ${fileType}` },
                // `detail: 'high'`: sem isso o modelo não lê o texto impresso na peça.
                { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
              ],
            }
          : {
              role: 'user',
              content: [
                `Nome do arquivo: ${fileName}`,
                `Tipo: ${fileType}`,
                '',
                'Conteúdo lido do arquivo:',
                '"""',
                documentText ?? '',
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
      source: imageDataUrl ? 'imagem' : 'texto',
      chars: documentText?.length ?? 0,
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
